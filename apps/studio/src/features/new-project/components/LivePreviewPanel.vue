<script setup lang="ts">
import { computed } from 'vue'
import { PIcon, cn } from '@platon/ui'
import { QUESTIONS, type QuestionId } from '../catalog'
import { useFlow } from '../flow'
import { useAnswerText } from '../useAnswerText'
import MiniAppPreview from './MiniAppPreview.vue'

const flow = useFlow()
const { t, summarize, questionText } = useAnswerText(flow)
const s = flow.state

const name = computed(() => s.name.trim() || s.brief?.name || t('newProject.newApp'))
const reading = computed(() => s.phase === 'intro' || s.phase === 'reading')

interface Row {
  id: 'brief' | QuestionId
  icon: string
  label: string
  value: string
  has: boolean
  now: boolean
}
const rows = computed<Row[]>(() => [
  {
    id: 'brief',
    icon: 'file-text',
    label: t('newProject.panel.brief'),
    value: reading.value
      ? t('newProject.panel.reading')
      : t('newProject.panel.reqs', { n: flow.inScope.value }, flow.inScope.value),
    has: !reading.value,
    now: false,
  },
  ...QUESTIONS.map((q, i) => {
    const a = s.answers[q.id]
    const now = s.phase === 'q' && s.qi === i
    return {
      id: q.id,
      icon: q.icon,
      label: questionText(q.id, 'label'),
      value: now ? t('newProject.panel.answering') : a ? summarize(q.id, a) : '—',
      has: !!a && !now,
      now,
    }
  }),
])
const canGo = (r: Row) => r.id !== 'brief' && (r.has || r.now) && !flow.locked.value
function go(r: Row) {
  if (r.id !== 'brief' && canGo(r)) flow.edit(r.id)
}
</script>

<template>
  <aside
    class="flex min-h-0 w-[340px] shrink-0 flex-col border-l border-line-soft bg-surface"
    :aria-label="t('newProject.panel.title')"
  >
    <div class="flex items-center px-[18px] pb-3 pt-4">
      <h2 class="text-md font-bold">{{ t('newProject.panel.title') }}</h2>
      <span class="ml-auto text-sm text-faint-2">
        {{
          s.phase === 'done'
            ? t('newProject.panel.created')
            : t('newProject.panel.answered', { n: flow.answeredCount.value, total: QUESTIONS.length })
        }}
      </span>
    </div>
    <div class="px-4">
      <MiniAppPreview
        :name="name"
        :hex="flow.theme.value.hex"
        :mode="flow.theme.value.mode"
        :radius="flow.theme.value.radius"
      />
    </div>
    <ul class="scroll-thin flex-1 overflow-auto px-2.5 pb-4 pt-3">
      <li v-for="r in rows" :key="r.id">
        <button
          type="button"
          :disabled="!canGo(r)"
          :class="
            cn(
              'flex w-full items-start gap-[11px] rounded-[10px] px-2 py-[9px] text-left',
              r.now ? 'bg-primary-tint/60' : 'enabled:hover:bg-subtle-2',
              !canGo(r) && 'cursor-default',
            )
          "
          @click="go(r)"
        >
          <span
            :class="
              cn(
                'grid size-[22px] shrink-0 place-items-center rounded-full',
                r.has ? 'bg-ink text-on-ink' : r.now ? 'bg-primary text-on-accent' : 'bg-subtle text-faint-2',
              )
            "
          >
            <PIcon :name="r.icon" :size="11" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-faint">{{ r.label }}</span>
            <span
              :class="
                cn(
                  'mt-px block text-base leading-snug',
                  r.has ? 'text-fg' : r.now ? 'text-primary-strong' : 'text-faint-2',
                )
              "
              >{{ r.value }}</span
            >
          </span>
        </button>
      </li>
    </ul>
  </aside>
</template>
