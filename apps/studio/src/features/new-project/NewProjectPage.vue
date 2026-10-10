<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { ChevronRight, PanelRight, RotateCcw } from 'lucide-vue-next'
import { PButton, cn } from '@platon/ui'
import type { CreateProjectRequest, ProjectSummary } from '@platon/definition'
import { http } from '@/services/http'
import { useSessionStore } from '@/stores/session'
import { useShortcuts } from '@/composables/useShortcuts'
import ProfileMenu from '@/components/shell/ProfileMenu.vue'
import { createNewProjectFlow, provideFlow } from './flow'
import ChatFeed from './components/ChatFeed.vue'
import IntroScreen from './components/IntroScreen.vue'
import LivePreviewPanel from './components/LivePreviewPanel.vue'
import StageStepper from './components/StageStepper.vue'
import PhaseDock from './components/dock/PhaseDock.vue'

const route = useRoute()
const { t } = useI18n()
const session = useSessionStore()
const qc = useQueryClient()

const queryPrompt = typeof route.query.prompt === 'string' ? route.query.prompt.trim() : ''

const flow = createNewProjectFlow({
  me: () =>
    session.user ? { id: session.user.id, name: session.user.name, email: session.user.email } : null,
  initialInput: queryPrompt || t('newProject.examples.field.text'),
  create: async (req: CreateProjectRequest) => {
    const p = (await http.post<ProjectSummary>('/projects', req)).data
    void qc.invalidateQueries({ queryKey: ['projects'] })
    return p
  },
})
provideFlow(flow)
onBeforeUnmount(flow.dispose)

const s = flow.state
const panel = ref(true)
const started = computed(() => s.phase !== 'intro')

/** Enter belongs to the focused control when it has its own meaning (textarea, combobox, add-requirement, buttons). */
function ownsEnter(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el || el === document.body) return false
  if (el.tagName === 'TEXTAREA' || el.closest('[data-own-enter]')) return true
  // An open combobox (team search) uses Enter to pick; once closed, Enter advances.
  if (el.getAttribute('role') === 'combobox') return el.getAttribute('aria-expanded') === 'true'
  // Option chips keep focus after a click; Enter should still advance like in the mockup.
  if ((el.tagName === 'BUTTON' || el.tagName === 'A') && !el.hasAttribute('data-option')) return true
  // Reka select/popover content lives in portals; leave Enter to it.
  return !!el.closest('[role="listbox"],[role="menu"],[role="dialog"]')
}

useShortcuts([
  { keys: 'mod+enter', run: () => (s.phase === 'intro' && flow.canStart.value ? flow.start() : false) },
  {
    keys: 'enter',
    inInputs: true,
    run: (e) => {
      if (e.shiftKey || e.isComposing || ownsEnter(e)) return false
      if (s.phase === 'q') return flow.valid.value ? flow.next() : false
      const typing = /^(INPUT|SELECT)$/.test((e.target as HTMLElement).tagName)
      if (typing) return false
      if (s.phase === 'brief') return flow.continueBrief()
      if (s.phase === 'summary') return flow.create()
      return false
    },
  },
  ...Array.from({ length: 9 }, (_, i) => ({ keys: String(i + 1), run: () => flow.pickByIndex(i + 1) })),
])
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-bg">
    <header class="flex h-[60px] shrink-0 items-center gap-3 border-b border-line-soft bg-surface px-5">
      <RouterLink
        to="/"
        :title="t('newProject.allApps')"
        :aria-label="t('newProject.allApps')"
        class="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-ink text-xl font-extrabold text-on-ink"
        >P</RouterLink
      >
      <nav
        class="flex shrink-0 items-center gap-2 whitespace-nowrap text-md font-medium text-muted"
        aria-label="Breadcrumb"
      >
        <RouterLink to="/" class="hover:text-fg">{{ session.session?.organization.name ?? '…' }}</RouterLink>
        <ChevronRight :size="13" class="text-faint-2" aria-hidden="true" />
        <span class="font-semibold text-fg" aria-current="page">{{ t('newProject.newApp') }}</span>
      </nav>
      <StageStepper
        v-if="started"
        class="ml-auto"
        :current="flow.stageIndex.value"
        :done="s.phase === 'done'"
      />
      <div class="ml-auto flex shrink-0 items-center gap-2">
        <template v-if="started">
          <PButton
            size="md"
            :icon="PanelRight"
            :aria-pressed="panel"
            :class="
              cn(panel && 'border-primary-ring bg-primary-tint text-primary-strong hover:bg-primary-tint')
            "
            @click="panel = !panel"
            >{{ t('newProject.preview') }}</PButton
          >
          <PButton
            size="md"
            square
            :icon="RotateCcw"
            :label="t('newProject.startOver')"
            @click="flow.restart"
          />
        </template>
        <ProfileMenu />
      </div>
    </header>

    <IntroScreen v-if="!started" />
    <div v-else class="flex min-h-0 flex-1">
      <main class="flex min-w-0 flex-1 flex-col">
        <ChatFeed />
        <div class="shrink-0 px-6 pb-5"><PhaseDock /></div>
      </main>
      <LivePreviewPanel v-if="panel" />
    </div>
  </div>
</template>
