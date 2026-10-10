<script setup lang="ts">
/** Left "Method layers" palette (searchable); drag into the builder or double-click to add at the end. */
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GripVertical, Search, X } from 'lucide-vue-next'
import { STEPS, type LogicFunction, type StepType } from '@platon/definition'
import { cn, PIcon, toneClasses } from '@platon/ui'
import { useLogicEditor } from '../../store'
import { defaultArgs, signature } from '../../lib/infer'

const props = defineProps<{
  mode: 'method' | 'calls' | 'consumers'
  functions: LogicFunction[]
  excludeFn?: string
}>()
const emit = defineEmits<{
  add: [type: StepType, config?: Record<string, string>]
  attach: [fn: LogicFunction]
}>()
const { t } = useI18n()
const ed = useLogicEditor()

const TYPES: StepType[] = [
  'if',
  'switch',
  'for',
  'set',
  'return',
  'select',
  'execute',
  'http',
  'produce',
  'consume',
]
const q = ref('')
const searching = ref(false)
const searchEl = ref<HTMLInputElement>()
watch(searching, async (v) => {
  await nextTick()
  if (v) searchEl.value?.focus()
})
const match = (s: string) => !q.value.trim() || s.toLowerCase().includes(q.value.trim().toLowerCase())
const types = computed(() =>
  props.mode === 'method' ? TYPES.filter((ty) => match(`${STEPS[ty].label} ${ty} ${STEPS[ty].group}`)) : [],
)
const groups = computed(() => {
  const m = new Map<string, StepType[]>()
  for (const ty of types.value) m.set(STEPS[ty].group, [...(m.get(STEPS[ty].group) ?? []), ty])
  return [...m.entries()]
})
const fns = computed(() =>
  props.functions.filter((f) => f.name !== props.excludeFn && match(`${f.name} ${f.description ?? ''}`)),
)
const title = computed(() =>
  props.mode === 'method'
    ? t('logic.palette.layers')
    : props.mode === 'consumers'
      ? t('logic.palette.consumers')
      : t('logic.palette.functions'),
)

function dragType(e: DragEvent, ty: StepType) {
  ed.drag = { kind: 'new', type: ty }
  e.dataTransfer?.setData('text/plain', ty)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}
function dragFn(e: DragEvent, f: LogicFunction) {
  ed.drag =
    props.mode === 'consumers'
      ? { kind: 'item', itemKind: 'functions', id: f.id }
      : { kind: 'new', type: 'call', config: { fn: f.name, args: defaultArgs(f), into: 'result' } }
  e.dataTransfer?.setData('text/plain', f.name)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}
function addFn(f: LogicFunction) {
  if (props.mode === 'consumers') emit('attach', f)
  else emit('add', 'call', { fn: f.name, args: defaultArgs(f), into: 'result' })
}
function closeSearch() {
  q.value = ''
  searching.value = false
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col border-t border-line-2">
    <div class="flex h-10 shrink-0 items-center gap-1.5 px-3">
      <template v-if="!searching">
        <span class="eyebrow flex-1">{{ title }}</span>
        <button
          type="button"
          class="grid size-6 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg"
          :title="t('logic.palette.search')"
          @click="searching = true"
        >
          <Search :size="13" />
        </button>
      </template>
      <div
        v-else
        class="flex h-7 flex-1 items-center gap-1.5 rounded-md border border-primary bg-surface px-2"
      >
        <Search :size="12" class="text-faint" />
        <input
          ref="searchEl"
          v-model="q"
          class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
          :placeholder="t('logic.palette.search')"
          @keydown.esc="closeSearch"
        />
        <button
          type="button"
          class="text-faint hover:text-fg"
          :aria-label="t('logic.close')"
          @click="closeSearch"
        >
          <X :size="12" />
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto px-2.5 pb-12 scroll-thin">
      <div v-if="!types.length && !fns.length" class="px-2 py-4 text-center text-sm text-faint">
        {{ t('logic.nothingMatches', { q }) }}<br />{{ t('logic.palette.askAi') }}
      </div>
      <div v-for="[g, list] in groups" :key="g" class="mb-2">
        <div class="px-1 pb-1 text-2xs font-semibold text-faint">{{ g }}</div>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="ty in list"
            :key="ty"
            type="button"
            draggable="true"
            :title="`${t(`logic.stepDesc.${ty}`)} · ${t('logic.palette.dragHint')}`"
            class="flex h-[54px] cursor-grab flex-col items-center justify-center gap-1 rounded-lg border border-line-2 bg-surface text-center hover:border-primary-ring hover:bg-primary-tint/40"
            @dragstart="dragType($event, ty)"
            @dragend="ed.drag = null"
            @dblclick="emit('add', ty)"
          >
            <span
              :class="
                cn(
                  'grid size-6 place-items-center rounded-md',
                  toneClasses[STEPS[ty].tone].bg,
                  toneClasses[STEPS[ty].tone].fg,
                )
              "
              ><PIcon :name="STEPS[ty].icon" :size="13"
            /></span>
            <span class="text-xs font-semibold text-fg-2">{{ STEPS[ty].label }}</span>
          </button>
        </div>
      </div>
      <div v-if="fns.length">
        <div v-if="mode === 'method'" class="px-1 pb-1 text-2xs font-semibold text-faint">Functions</div>
        <div class="flex flex-col gap-1">
          <button
            v-for="f in fns"
            :key="f.id"
            type="button"
            draggable="true"
            :title="`${f.name}${signature(f)} · ${t('logic.palette.dragHint')}`"
            class="flex cursor-grab items-center gap-2 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-left hover:border-primary-ring hover:bg-primary-tint/40"
            @dragstart="dragFn($event, f)"
            @dragend="ed.drag = null"
            @dblclick="addFn(f)"
          >
            <GripVertical :size="12" class="shrink-0 text-faint-2" />
            <span
              class="grid size-6 shrink-0 place-items-center rounded-md bg-primary-tint text-primary-strong"
              ><PIcon name="braces" :size="12"
            /></span>
            <span class="min-w-0">
              <span class="block truncate font-mono text-sm font-semibold">{{ f.name }}</span>
              <span class="block truncate font-mono text-2xs text-faint">{{ signature(f) }}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
