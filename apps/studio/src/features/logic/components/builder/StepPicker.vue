<script setup lang="ts">
/** "Find a layer…" list shown when pressing + between layers. ↑ ↓ to move, Enter to add, Esc to close. */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { STEPS, type CatalogTone, type LogicFunction, type StepType } from '@platon/definition'
import { cn } from '@platon/ui'
import ToneTile from '../ToneTile.vue'
import { defaultArgs, signature } from '../../lib/infer'

export interface PickedStep {
  type: StepType
  config?: Record<string, string>
}

const props = defineProps<{ mode: 'method' | 'calls'; functions: LogicFunction[]; allowReturn?: boolean }>()
const emit = defineEmits<{ pick: [p: PickedStep]; close: [] }>()
const { t } = useI18n()

const CODE: Partial<Record<StepType, string>> = {
  select: 'sql.select',
  execute: 'sql.execute',
  produce: 'mq.produce',
  consume: 'mq.consume',
}
const ORDER: { group: string; types: StepType[] }[] = [
  { group: 'Data', types: ['select', 'execute'] },
  { group: 'Logic', types: ['set', 'if', 'switch', 'for', 'return'] },
  { group: 'Integrations', types: ['http', 'produce', 'consume'] },
]

interface Entry {
  key: string
  group: string
  label: string
  code: string
  desc: string
  icon: string
  tone: CatalogTone
  pick: PickedStep
}

const q = ref('')
const active = ref(0)
const input = ref<HTMLInputElement>()
const list = ref<HTMLElement>()

const all = computed<Entry[]>(() => {
  const out: Entry[] = []
  const types =
    props.mode === 'method'
      ? ORDER
      : props.allowReturn
        ? [{ group: 'Logic', types: ['return'] as StepType[] }]
        : []
  for (const g of types)
    for (const ty of g.types)
      out.push({
        key: ty,
        group: g.group,
        label: STEPS[ty].label,
        code: CODE[ty] ?? ty,
        desc: t(`logic.stepDesc.${ty}`),
        icon: STEPS[ty].icon,
        tone: STEPS[ty].tone,
        pick: { type: ty },
      })
  for (const f of props.functions)
    out.push({
      key: `fn:${f.id}`,
      group: props.mode === 'method' ? 'Functions' : t('logic.picker.savedFunctions'),
      label: f.name,
      code: 'call',
      desc: signature(f),
      icon: STEPS.call.icon,
      tone: STEPS.call.tone,
      pick: { type: 'call', config: { fn: f.name, args: defaultArgs(f), into: 'result' } },
    })
  return out
})

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  return s
    ? all.value.filter((e) => `${e.label} ${e.code} ${e.desc} ${e.group}`.toLowerCase().includes(s))
    : all.value
})
const groups = computed(() => {
  const m = new Map<string, { entry: Entry; i: number }[]>()
  filtered.value.forEach((entry, i) => m.set(entry.group, [...(m.get(entry.group) ?? []), { entry, i }]))
  return [...m.entries()]
})

watch(q, () => (active.value = 0))
watch(active, async (i) => {
  await nextTick()
  list.value?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' })
})
onMounted(() => setTimeout(() => input.value?.focus(), 20))

function onKey(e: KeyboardEvent) {
  const n = filtered.value.length
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    active.value = (active.value + 1) % n
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    active.value = (active.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const x = filtered.value[active.value]
    if (x) emit('pick', x.pick)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}
</script>

<template>
  <div class="flex max-h-[420px] flex-col">
    <div class="border-b border-line-faint p-2">
      <div
        class="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-primary focus-within:shadow-focus"
      >
        <Search :size="14" class="text-faint" />
        <input
          ref="input"
          v-model="q"
          class="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint-2"
          :placeholder="mode === 'method' ? t('logic.picker.findLayer') : t('logic.picker.findFunction')"
          @keydown="onKey"
        />
      </div>
    </div>
    <div ref="list" class="min-h-0 flex-1 overflow-auto p-1.5 scroll-thin" role="listbox">
      <div v-if="!filtered.length" class="px-3 py-6 text-center text-sm text-faint">
        {{ t('logic.nothingMatches', { q }) }}
      </div>
      <div v-for="[g, items] in groups" :key="g" class="mb-1">
        <div class="eyebrow px-2 pb-1 pt-2">{{ g }}</div>
        <button
          v-for="{ entry, i } in items"
          :key="entry.key"
          type="button"
          role="option"
          :data-i="i"
          :aria-selected="i === active"
          :class="
            cn(
              'flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left',
              i === active ? 'bg-primary-tint' : 'hover:bg-hover',
            )
          "
          @mouseenter="active = i"
          @click="emit('pick', entry.pick)"
        >
          <ToneTile :icon="entry.icon" :tone="entry.tone" />
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1.5">
              <span class="truncate text-md font-semibold text-fg">{{ entry.label }}</span>
              <span
                class="shrink-0 rounded border border-line-soft bg-subtle px-1 font-mono text-2xs text-muted"
                >{{ entry.code }}</span
              >
            </span>
            <span class="line-clamp-2 text-xs text-muted" :class="entry.code === 'call' && 'font-mono'">{{
              entry.desc
            }}</span>
          </span>
        </button>
      </div>
    </div>
    <div class="flex gap-3 border-t border-line-faint px-3 py-1.5 text-2xs text-faint">
      <span>↑ ↓ {{ t('logic.picker.move') }}</span
      ><span>↵ {{ t('logic.picker.add') }}</span
      ><span>Esc {{ t('logic.picker.close') }}</span>
    </div>
  </div>
</template>
