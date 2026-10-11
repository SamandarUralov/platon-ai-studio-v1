<script setup lang="ts">
/**
 * Containers: container (card / box), section, grid, columns, tabs (Platon UI Kit) and accordion.
 * Each cell's blocks come from the caller through the `cell` slot, so the same layout serves the
 * Preview/runtime (plain blocks) and the canvas (selectable, droppable blocks).
 */
import { computed, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { columnWeights, slotLabels } from '@platon/definition'
import { KitTabsContainer } from '../kit'
import { type BlockProps, CARD, type CellSlotProps, GAP_CLASS, str, tr, useResolved } from './props'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
defineSlots<{ cell?: (p: CellSlotProps) => unknown }>()
const r = useResolved(props)
const t = computed(() => props.block.type)
const labels = computed(() => slotLabels(props.block))
const count = computed(() => labels.value.length)
const title = computed(() => tr(props, 'title', r.value.title ?? ''))
const gap = computed(() => (['none', 'sm', 'md', 'lg'].includes(str(r.value.gap)) ? str(r.value.gap) : 'md'))
const PAD = { none: 'p-0', sm: 'p-2.5', md: 'p-4', lg: 'p-6' } as Record<string, string>
const direction = computed<'column' | 'row'>(() => (r.value.direction === 'row' ? 'row' : 'column'))
const cell = (i: number): CellSlotProps => ({
  slot: i,
  count: count.value,
  gap: gap.value,
  direction: direction.value,
})

// container
const box = computed(() => {
  const v = str(r.value.variant, 'card')
  const pad = PAD[str(r.value.padding, 'md')] ?? PAD.md
  if (v === 'plain') return ''
  if (v === 'outlined') return `rounded-(--app-radius-lg) border border-(--app-line) ${pad}`
  if (v === 'filled') return `rounded-(--app-radius-lg) bg-(--app-subtle) ${pad}`
  return `${CARD} ${pad}`
})

// grid / columns
const STACK: Record<string, string> = {
  mobile: '@max-[560px]:grid-cols-1!',
  tablet: '@max-[900px]:grid-cols-1!',
  never: '',
}
const stack = computed(() => STACK[str(r.value.stackOn, 'mobile')] ?? STACK.mobile)
const template = computed(() => {
  if (t.value === 'columns')
    return columnWeights(r.value.ratio)
      .map((w) => `minmax(0,${w}fr)`)
      .join(' ')
  const cols = Math.min(6, Math.max(1, Math.round(Number(r.value.columns)) || 2))
  return `repeat(${cols}, minmax(0, 1fr))`
})
const ALIGN: Record<string, string> = { start: 'items-start', center: 'items-center', end: 'items-end' }
const align = computed(() => ALIGN[str(r.value.align)] ?? 'items-stretch')

// tabs
const active = ref(String(Math.max(0, Number(r.value.active) || 0)))
const tabs = computed(() => labels.value.map((label, i) => ({ value: String(i), label })))
const position = computed(() =>
  ['top', 'bottom', 'left', 'right'].includes(str(r.value.position)) ? str(r.value.position) : 'top',
)
function onTab(v: unknown) {
  active.value = String(v)
  emit('event', 'change', Number(v))
}

// accordion
const startOpen = () => {
  const o = str(r.value.open, 'first')
  return o === 'all' ? labels.value.map((_, i) => i) : o === 'none' ? [] : [0]
}
const open = ref<number[]>(startOpen())
function togglePanel(i: number) {
  const isOpen = open.value.includes(i)
  if (r.value.multiple === true) open.value = isOpen ? open.value.filter((x) => x !== i) : [...open.value, i]
  else open.value = isOpen ? [] : [i]
  emit('event', 'change', [...open.value])
}
</script>

<template>
  <!-- container -->
  <div v-if="t === 'container'" :class="box">
    <div v-if="title" class="mb-3 text-[14px] font-bold">{{ title }}</div>
    <slot name="cell" v-bind="cell(0)" />
  </div>

  <!-- section -->
  <section
    v-else-if="t === 'section'"
    :class="
      r.variant === 'card'
        ? `${CARD} p-5`
        : r.variant === 'tinted'
          ? 'rounded-(--app-radius-lg) bg-(--app-accent-tint) p-5'
          : ''
    "
  >
    <header v-if="title || r.subtitle" class="mb-4">
      <h2 v-if="title" class="m-0 text-[17px] font-bold">{{ title }}</h2>
      <p v-if="r.subtitle" class="mt-1 mb-0 text-[13px] text-(--app-muted)">
        {{ tr(props, 'subtitle', str(r.subtitle)) }}
      </p>
    </header>
    <slot name="cell" v-bind="cell(0)" />
  </section>

  <!-- grid / columns -->
  <div v-else-if="t === 'grid' || t === 'columns'" class="@container">
    <div
      class="grid"
      :class="[GAP_CLASS[gap], stack, t === 'columns' ? align : '']"
      :style="{ gridTemplateColumns: template }"
    >
      <div v-for="(_, i) in labels" :key="i" class="min-w-0">
        <slot name="cell" v-bind="cell(i)" />
      </div>
    </div>
  </div>

  <!-- tabs (Platon UI Kit) -->
  <div v-else-if="t === 'tabs'" class="pk" :class="CARD">
    <KitTabsContainer
      :model-value="active"
      :tabs="tabs"
      :position="position"
      :label="title || 'Tabs'"
      @update:model-value="onTab"
    >
      <template #content="{ tab }">
        <div class="pk-slot p-4">
          <slot name="cell" v-bind="cell(Number(tab.value))" />
        </div>
      </template>
    </KitTabsContainer>
  </div>

  <!-- accordion -->
  <div v-else :class="CARD" class="divide-y divide-(--app-line) overflow-hidden">
    <div v-if="title" class="px-4 py-3 text-[14px] font-bold">{{ title }}</div>
    <div v-for="(l, i) in labels" :key="i">
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-3 text-left text-[13.5px] font-semibold hover:bg-(--app-hover)"
        :aria-expanded="open.includes(i)"
        @click.stop="togglePanel(i)"
      >
        <span class="min-w-0 flex-1 truncate">{{ l }}</span>
        <ChevronDown
          :size="15"
          class="shrink-0 text-(--app-faint) transition-transform"
          :class="open.includes(i) ? 'rotate-180' : ''"
        />
      </button>
      <div v-show="open.includes(i)" class="px-4 pt-1 pb-4">
        <slot name="cell" v-bind="cell(i)" />
      </div>
    </div>
  </div>
</template>
