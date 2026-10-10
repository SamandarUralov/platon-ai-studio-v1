<script setup lang="ts">
/** Element tile: drag onto the canvas, or double-click / Enter to add it below the selection. */
import { ref } from 'vue'
import { PIcon } from '@platon/ui'
import type { BlockMeta, BlockType } from '@platon/definition'
import { useDraggable } from '../composables/dnd'

const props = defineProps<{ type: BlockType; meta: BlockMeta }>()
const emit = defineEmits<{ add: [] }>()
const el = ref<HTMLElement>()
const dragging = ref(false)
useDraggable(el, () => ({ kind: 'new', type: props.type }), {
  onStart: () => (dragging.value = true),
  onEnd: () => (dragging.value = false),
})
</script>

<template>
  <button
    ref="el"
    type="button"
    class="relative flex h-[76px] cursor-grab flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface px-1.5 text-center text-sm font-semibold text-fg hover:border-primary-ring hover:shadow-card active:cursor-grabbing"
    :class="dragging ? 'opacity-50' : ''"
    :title="meta.hint"
    @dblclick="emit('add')"
    @keydown.enter.prevent="emit('add')"
  >
    <span v-if="meta.kit" class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-teal" />
    <span class="grid size-8 place-items-center rounded-lg bg-primary-tint text-primary-strong"
      ><PIcon :name="meta.icon" :size="16"
    /></span>
    <span class="w-full truncate leading-tight">{{ meta.label }}</span>
  </button>
</template>
