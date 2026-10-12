<script setup lang="ts">
/**
 * The blocks of one cell (the page itself, or a container cell) laid out in rows, recursing into
 * containers. Visibility is applied for the viewer (Preview / runtime).
 */
import { computed } from 'vue'
import { cellBlocks, toRows, type Block } from '@platon/definition'
import type { RenderContext } from './context'
import { canSeeBlock } from './visibility'
import { GAP_CLASS } from './blocks/props'
import { rowGridClasses } from './grid'
import BlockView from './BlockView.vue'

const props = withDefaults(
  defineProps<{
    blocks: Block[]
    ctx: RenderContext
    parent?: string
    /** Cell index inside the parent container. */
    index?: number
    count?: number
    /** Container gap (none/sm/md/lg); anything else keeps the page spacing. */
    gap?: string
    direction?: 'column' | 'row'
  }>(),
  { index: 0, gap: 'page', direction: 'column' },
)
const emit = defineEmits<{ event: [block: Block, name: string, arg?: unknown] }>()
defineSlots<{ custom?: (p: { block: Block }) => unknown }>()

const visible = computed(() =>
  cellBlocks(props.blocks, props.parent, props.index, props.count).filter(
    (b) =>
      props.ctx.overrides?.[b.ref]?.visible !== false &&
      canSeeBlock(props.ctx.definition, b, props.ctx.viewer, props.ctx.lang),
  ),
)
// Side-by-side containers put every child in one wrapping row; other cells lay each row out on the
// 12-column grid.
const sideBySide = computed(() => props.direction === 'row')
const rows = computed(() =>
  (sideBySide.value ? [visible.value] : toRows(visible.value))
    .filter((r) => r.length)
    .map((r) => ({ blocks: r, cols: sideBySide.value ? [] : rowGridClasses(r) })),
)
</script>

<template>
  <div v-if="rows.length" class="@container flex flex-col" :class="GAP_CLASS[gap] ?? 'gap-5'">
    <div
      v-for="(row, i) in rows"
      :key="i"
      :class="[sideBySide ? 'flex flex-wrap' : 'grid grid-cols-12', GAP_CLASS[gap] ?? 'gap-4']"
    >
      <BlockView
        v-for="(b, j) in row.blocks"
        :key="b.id"
        :block="b"
        :ctx="ctx"
        :class="sideBySide ? 'min-w-[min(100%,240px)] flex-1' : ['min-w-0', row.cols[j]]"
        @event="(n, a) => emit('event', b, n, a)"
      >
        <template #custom="s"><slot name="custom" v-bind="s" /></template>
        <template #cell="c">
          <BlockRows
            :blocks="blocks"
            :ctx="ctx"
            :parent="c.block.id"
            :index="c.slot"
            :count="c.count"
            :gap="c.gap"
            :direction="c.direction"
            @event="(blk, n, a) => emit('event', blk, n, a)"
          >
            <template #custom="s"><slot name="custom" v-bind="s" /></template>
          </BlockRows>
        </template>
      </BlockView>
    </div>
  </div>
</template>
