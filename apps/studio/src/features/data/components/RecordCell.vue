<script setup lang="ts">
/** One record value rendered by field type (pill, link, check, file, number…). */
import { computed } from 'vue'
import { Check, Link2, Paperclip } from 'lucide-vue-next'
import { toneClasses, type Tone } from '@platon/ui'
import type { TableField } from '@platon/definition'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ field: TableField; value: unknown }>()
const m = useData()
const empty = computed(() => props.value === undefined || props.value === null || props.value === '')
const text = computed(() =>
  typeof props.value === 'object' ? JSON.stringify(props.value) : String(props.value ?? ''),
)
const PILL_TONES: Tone[] = ['primary', 'teal', 'purple', 'info', 'warn', 'ok']
const tone = computed<Tone>(() => {
  const f = props.field
  if (f.type === 'workflow_state') return m.workflowTone(f.workflow, text.value) ?? 'neutral'
  const i = f.options?.indexOf(text.value) ?? -1
  return i < 0 ? 'neutral' : PILL_TONES[i % PILL_TONES.length]!
})
</script>

<template>
  <span v-if="empty" class="text-faint-2">—</span>
  <span
    v-else-if="field.type === 'single_select' || field.type === 'workflow_state'"
    :class="[
      'inline-flex h-[21px] items-center truncate rounded-full px-2 text-xs font-semibold',
      toneClasses[tone].bg,
      toneClasses[tone].fg,
    ]"
    >{{ text }}</span
  >
  <span v-else-if="field.type === 'link'" class="inline-flex min-w-0 items-center gap-1 text-primary-strong"
    ><Link2 :size="12" class="shrink-0" /><span class="truncate">{{ text }}</span></span
  >
  <Check
    v-else-if="field.type === 'checkbox'"
    :size="15"
    :class="value === true || value === 'true' ? 'text-ok' : 'text-faint-2 opacity-40'"
  />
  <span v-else-if="field.type === 'file'" class="inline-flex items-center gap-1 text-muted"
    ><Paperclip :size="12" />{{ text }}</span
  >
  <span v-else-if="field.type === 'auto_number'" class="font-mono text-sm text-fg-2">{{ text }}</span>
  <span
    v-else
    :class="['truncate', field.type === 'number' || field.type === 'currency' ? 'ml-auto tabular-nums' : '']"
    >{{ text }}</span
  >
</template>
