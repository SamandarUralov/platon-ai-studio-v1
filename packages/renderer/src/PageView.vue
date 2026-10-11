<script setup lang="ts">
/** A page's blocks laid out in rows (containers nest their own rows), with visibility applied. */
import type { Block, Page } from '@platon/definition'
import type { RenderContext } from './context'
import BlockRows from './BlockRows.vue'

defineProps<{ page: Page; ctx: RenderContext }>()
const emit = defineEmits<{ event: [block: Block, name: string, arg?: unknown] }>()
defineSlots<{ custom?: (p: { block: Block }) => unknown }>()
</script>

<template>
  <BlockRows :blocks="page.blocks" :ctx="ctx" @event="(b, n, a) => emit('event', b, n, a)">
    <template #custom="s"><slot name="custom" v-bind="s" /></template>
  </BlockRows>
</template>
