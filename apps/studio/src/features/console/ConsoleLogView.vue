<script setup lang="ts">
/** Console tab: newest at the bottom, sticks to the bottom while new entries arrive. */
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ChevronRight, CircleX, Info, TriangleAlert } from 'lucide-vue-next'
import dayjs from 'dayjs'
import { useDefinitionStore } from '@/stores/definition'
import { linkForPointer } from '@/composables/definitionLinks'
import { useConsoleStore, type ConsoleEntry, type LogLevel } from './useConsoleLog'

const { t } = useI18n()
const router = useRouter()
const store = useConsoleStore()
const def = useDefinitionStore()

const LEVEL: Record<LogLevel, { icon: typeof Info; icon_cls: string; msg: string; row: string }> = {
  info: { icon: Info, icon_cls: 'text-primary-ring dark:text-primary-strong', msg: 'text-code-fg', row: '' },
  log: { icon: ChevronRight, icon_cls: 'text-code-muted', msg: 'text-code-fg', row: '' },
  warn: {
    icon: TriangleAlert,
    icon_cls: 'text-warn-dot',
    msg: 'text-warn-bg dark:text-warn',
    row: 'bg-warn-dot/[0.06]',
  },
  error: {
    icon: CircleX,
    icon_cls: 'text-danger-dot',
    msg: 'text-danger-bg dark:text-danger',
    row: 'bg-danger-dot/[0.08]',
  },
}

function target(e: ConsoleEntry) {
  return e.path && def.projectId ? linkForPointer(def.projectId, e.path, def.definition) : null
}
function open(e: ConsoleEntry) {
  const tg = target(e)
  if (tg) void router.push(tg.to)
}
</script>

<template>
  <!-- column-reverse keeps the scroll pinned to the newest entry -->
  <div
    class="flex min-h-0 flex-1 flex-col-reverse overflow-auto font-mono text-xs leading-relaxed scroll-thin"
    role="log"
    aria-live="polite"
  >
    <div class="py-1.5">
      <div
        v-for="e in store.visible"
        :key="e.id"
        class="group grid grid-cols-[64px_16px_160px_minmax(0,1fr)] gap-2 px-3.5 py-0.5"
        :class="LEVEL[e.level].row"
      >
        <span class="text-code-muted">{{ dayjs(e.at).format('HH:mm:ss') }}</span>
        <component :is="LEVEL[e.level].icon" :size="12" class="mt-[3px]" :class="LEVEL[e.level].icon_cls" />
        <span class="truncate text-primary-ring dark:text-primary-strong" :title="e.source">{{
          e.source
        }}</span>
        <span class="whitespace-pre-wrap break-words" :class="LEVEL[e.level].msg"
          >{{ e.message
          }}<button
            v-if="target(e)"
            type="button"
            class="ml-2 rounded px-1 font-sans text-2xs font-semibold text-code-muted opacity-0 hover:bg-code-sel hover:text-code-fg focus-visible:opacity-100 group-hover:opacity-100"
            @click="open(e)"
          >
            {{ t('console.openIn', { layer: target(e)!.layer }) }} →
          </button></span
        >
      </div>
      <div v-if="!store.visible.length" class="px-3.5 py-3 font-sans text-sm text-code-muted">
        {{ store.entries.length ? t('console.noMatch') : t('console.empty') }}
      </div>
    </div>
  </div>
</template>
