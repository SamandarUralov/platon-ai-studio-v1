<script setup lang="ts">
/**
 * Console dock (F15): Console log stream · Tests · Terminal. Tabs on the left, console filters next
 * to them. Drag the top edge to resize (saved in ui.consoleHeight); Esc closes it while focused.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Ban,
  CircleX,
  FlaskConical,
  List,
  Maximize2,
  Minimize2,
  Play,
  ScrollText,
  Search,
  SquareTerminal,
  TriangleAlert,
  X,
} from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { useDefinitionStore } from '@/stores/definition'
import { kbd } from '@/composables/useShortcuts'
import { useConsoleStore, type ConsoleTab, type LogFilter } from './useConsoleLog'
import { useTests } from './useTests'
import ConsoleLogView from './ConsoleLogView.vue'
import TestsView from './TestsView.vue'
import TerminalView from './TerminalView.vue'

const { t } = useI18n()
const ui = useUiStore()
const def = useDefinitionStore()
const store = useConsoleStore()
const tests = useTests()

const MIN = 140
const maxH = () => Math.round(window.innerHeight * 0.8)
const height = computed(() => Math.min(Math.max(ui.consoleHeight, MIN), maxH()))
const restoreTo = ref<number | null>(null)
const maximized = computed(() => restoreTo.value !== null)

function toggleMax() {
  if (restoreTo.value !== null) {
    ui.consoleHeight = restoreTo.value
    restoreTo.value = null
  } else {
    restoreTo.value = ui.consoleHeight
    ui.consoleHeight = Math.round(window.innerHeight * 0.62)
  }
}

function startResize(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const startY = e.clientY
  const start = height.value
  restoreTo.value = null
  const move = (ev: PointerEvent) =>
    (ui.consoleHeight = Math.min(maxH(), Math.max(MIN, start + startY - ev.clientY)))
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
}

function onResizeKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 60 : 20
  if (e.key === 'ArrowUp') ui.consoleHeight = Math.min(maxH(), height.value + step)
  else if (e.key === 'ArrowDown') ui.consoleHeight = Math.max(MIN, height.value - step)
  else return
  e.preventDefault()
}

const tabs = computed(() => [
  {
    id: 'console' as ConsoleTab,
    label: t('console.tabConsole'),
    icon: ScrollText,
    badge: store.counts.error,
  },
  {
    id: 'tests' as ConsoleTab,
    label: t('console.tabTests'),
    icon: FlaskConical,
    badge: tests.summary.value.failed,
  },
  { id: 'terminal' as ConsoleTab, label: t('console.tabTerminal'), icon: SquareTerminal, badge: 0 },
])

const filters = computed(() => [
  {
    id: 'all' as LogFilter,
    label: t('console.all'),
    icon: List,
    n: store.counts.all,
    cls: 'text-code-muted',
  },
  {
    id: 'warn' as LogFilter,
    label: t('console.warnings'),
    icon: TriangleAlert,
    n: store.counts.warn,
    cls: 'text-warn-dot',
  },
  {
    id: 'error' as LogFilter,
    label: t('console.errors'),
    icon: CircleX,
    n: store.counts.error,
    cls: 'text-danger-dot',
  },
])

function clear() {
  if (store.tab === 'console') store.clear()
  else if (store.tab === 'tests') tests.reset()
  else store.shellLines = []
}

const testSummary = computed(() => {
  const s = tests.summary.value
  return s.ran
    ? t('console.testSummary', { passed: s.passed, failed: s.failed, total: s.total })
    : t('console.testCount', { n: s.total })
})
</script>

<template>
  <section
    class="relative flex shrink-0 border-t border-code-line bg-code-bg-2 text-code-fg"
    :style="{ height: `${height}px` }"
    :aria-label="t('console.label')"
    @keydown.esc.stop="ui.consoleOpen = false"
  >
    <div
      class="absolute -top-1 left-0 right-0 z-10 h-2 cursor-row-resize outline-none hover:bg-primary/40 focus-visible:bg-primary/60"
      role="separator"
      aria-orientation="horizontal"
      :aria-label="t('console.resize')"
      :aria-valuenow="height"
      tabindex="0"
      @pointerdown="startResize"
      @keydown="onResizeKey"
    />

    <!-- tabs (left) -->
    <nav
      class="flex w-[150px] shrink-0 flex-col gap-0.5 border-r border-code-line bg-code-bg px-1.5 py-2"
      role="tablist"
      aria-orientation="vertical"
    >
      <button
        v-for="tb in tabs"
        :key="tb.id"
        type="button"
        role="tab"
        :aria-selected="store.tab === tb.id"
        class="flex h-[30px] items-center gap-2 rounded-[7px] px-2.5 text-left text-sm font-semibold"
        :class="
          store.tab === tb.id
            ? 'bg-code-sel text-code-fg'
            : 'text-code-muted hover:bg-code-line hover:text-code-fg'
        "
        @click="store.tab = tb.id"
      >
        <component :is="tb.icon" :size="13" />
        <span class="flex-1">{{ tb.label }}</span>
        <span
          v-if="tb.badge"
          class="grid h-4 min-w-4 place-items-center rounded-full bg-danger-dot px-1 text-[10px] font-bold text-white"
          >{{ tb.badge }}</span
        >
      </button>
    </nav>

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- toolbar -->
      <div class="flex h-[38px] shrink-0 items-center gap-1 border-b border-code-line bg-code-bg pl-2.5 pr-2">
        <template v-if="store.tab === 'console'">
          <div class="flex gap-0.5" role="radiogroup" :aria-label="t('console.filter')">
            <button
              v-for="f in filters"
              :key="f.id"
              type="button"
              role="radio"
              :aria-checked="store.filter === f.id"
              class="flex h-[26px] items-center gap-1.5 rounded-md px-2 text-xs font-semibold"
              :class="
                store.filter === f.id ? 'bg-code-sel text-code-fg' : 'text-code-muted hover:text-code-fg'
              "
              @click="store.filter = f.id"
            >
              <component :is="f.icon" :size="12" :class="f.cls" />{{ f.label
              }}<span class="text-2xs text-code-muted">{{ f.n }}</span>
            </button>
          </div>
          <div class="relative ml-2 flex w-56 items-center">
            <Search :size="12" class="pointer-events-none absolute left-2 text-code-muted" />
            <input
              v-model="store.search"
              type="search"
              :placeholder="t('console.search')"
              :aria-label="t('console.search')"
              class="h-[26px] w-full rounded-md border border-code-line bg-code-bg-2 pl-6 pr-2 text-xs text-code-fg outline-none placeholder:text-code-muted focus:border-primary"
            />
          </div>
        </template>
        <template v-else-if="store.tab === 'tests'">
          <span class="px-1 text-xs text-code-muted">{{ testSummary }}</span>
          <button
            type="button"
            class="ml-1 flex h-[26px] items-center gap-1.5 rounded-[7px] bg-primary px-2.5 text-xs font-bold text-on-accent hover:bg-primary-hover disabled:opacity-60"
            :disabled="tests.summary.value.running"
            @click="tests.run()"
          >
            <Play :size="12" />{{ t('console.runAll') }}
          </button>
        </template>
        <span v-else class="flex items-center gap-1.5 px-1 text-xs text-code-muted">
          <span class="size-1.5 rounded-full bg-ok-dot" />{{
            def.definition?.settings.slug ?? def.projectId
          }}
          · development
        </span>

        <div class="flex-1" />
        <button
          type="button"
          class="grid size-7 place-items-center rounded-[7px] text-code-muted hover:bg-code-line hover:text-code-fg"
          :title="t('console.clear')"
          :aria-label="t('console.clear')"
          @click="clear"
        >
          <Ban :size="13" />
        </button>
        <button
          type="button"
          class="grid size-7 place-items-center rounded-[7px] text-code-muted hover:bg-code-line hover:text-code-fg"
          :title="maximized ? t('console.restore') : t('console.maximize')"
          :aria-label="maximized ? t('console.restore') : t('console.maximize')"
          @click="toggleMax"
        >
          <component :is="maximized ? Minimize2 : Maximize2" :size="13" />
        </button>
        <button
          type="button"
          class="grid size-7 place-items-center rounded-[7px] text-code-muted hover:bg-code-line hover:text-code-fg"
          :title="t('console.close', { kbd: kbd('ctrl+`') })"
          :aria-label="t('console.close', { kbd: kbd('ctrl+`') })"
          @click="ui.consoleOpen = false"
        >
          <X :size="14" />
        </button>
      </div>

      <ConsoleLogView v-if="store.tab === 'console'" />
      <TestsView v-else-if="store.tab === 'tests'" :tests="tests" />
      <TerminalView v-else :tests="tests" />
    </div>
  </section>
</template>
