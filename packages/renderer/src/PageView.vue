<script setup lang="ts">
/** A page's blocks laid out in rows, with visibility applied for the viewer (Preview / runtime). */
import { computed } from 'vue'
import { toRows, type Block, type Page } from '@platon/definition'
import type { RenderContext } from './context'
import { canSeeBlock } from './visibility'
import BlockView from './BlockView.vue'

const props = defineProps<{ page: Page; ctx: RenderContext }>()
const emit = defineEmits<{ event: [block: Block, name: string, arg?: unknown] }>()
defineSlots<{ custom?: (p: { block: Block }) => unknown }>()

const rows = computed(() =>
  toRows(props.page.blocks)
    .map((row) =>
      row.filter(
        (b) =>
          props.ctx.overrides?.[b.ref]?.visible !== false &&
          canSeeBlock(props.ctx.definition, b, props.ctx.viewer, props.ctx.lang),
      ),
    )
    .filter((r) => r.length),
)
</script>

<template>
  <div class="flex flex-col gap-5">
    <div v-for="(row, i) in rows" :key="i" class="flex flex-wrap gap-4">
      <BlockView
        v-for="b in row"
        :key="b.id"
        :block="b"
        :ctx="ctx"
        class="min-w-[min(100%,240px)] flex-1"
        @event="(n, a) => emit('event', b, n, a)"
      >
        <template #custom="s"><slot name="custom" v-bind="s" /></template>
      </BlockView>
    </div>
  </div>
</template>
