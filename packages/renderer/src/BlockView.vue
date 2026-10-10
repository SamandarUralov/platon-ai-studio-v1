<script setup lang="ts">
/**
 * Renders one block of any BlockType. Props-driven (no Studio stores) so the canvas, Preview and
 * the generated-app runtime share it. Custom components render through the `custom` slot.
 */
import { computed, type Component } from 'vue'
import type { Block } from '@platon/definition'
import type { RenderContext } from './context'
import { blockStyle } from './style'
import HeaderBlock from './blocks/HeaderBlock.vue'
import BasicBlock from './blocks/BasicBlock.vue'
import StatsBlock from './blocks/StatsBlock.vue'
import TableBlock from './blocks/TableBlock.vue'
import RecordBlock from './blocks/RecordBlock.vue'
import ControlBlock from './blocks/ControlBlock.vue'
import ChartBlock from './blocks/ChartBlock.vue'
import WidgetBlock from './blocks/WidgetBlock.vue'

const props = defineProps<{ block: Block; ctx: RenderContext }>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
defineSlots<{ custom?: (p: { block: Block }) => unknown }>()

const VIEWS: Partial<Record<Block['type'], Component>> = {
  header: HeaderBlock,
  text: BasicBlock,
  image: BasicBlock,
  button: BasicBlock,
  divider: BasicBlock,
  stats: StatsBlock,
  table: TableBlock,
  form: RecordBlock,
  list: RecordBlock,
  detail: RecordBlock,
  input: ControlBlock,
  select: ControlBlock,
  checkbox: ControlBlock,
  radio: ControlBlock,
  switch: ControlBlock,
  date: ControlBlock,
  textarea: ControlBlock,
  upload: ControlBlock,
  bar: ChartBlock,
  line: ChartBlock,
  donut: ChartBlock,
  calendar: WidgetBlock,
  progress: WidgetBlock,
  timeline: WidgetBlock,
  tabs: WidgetBlock,
  steps: WidgetBlock,
  alert: WidgetBlock,
  pagination: WidgetBlock,
}
const view = computed(() => VIEWS[props.block.type])
const style = computed(() => blockStyle(props.block.style))
</script>

<template>
  <div class="min-w-0 text-(--app-fg)" :style="style" :data-block="block.ref">
    <slot v-if="block.type === 'custom'" name="custom" :block="block" />
    <component
      :is="view"
      v-else-if="view"
      :block="block"
      :ctx="ctx"
      @event="(n: string, a?: unknown) => emit('event', n, a)"
    />
  </div>
</template>
