<script setup lang="ts">
/**
 * Quick actions for the selected block, drawn by Studio over the Sandbox iframe: move within its
 * cell, duplicate, delete. Positioned from the rect the Sandbox reports (iframe CSS pixels).
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Trash2 } from 'lucide-vue-next'
import type { Rect } from '@platon/bridge/sandbox'
import type { MoveDir } from '../lib/blocks'

const props = defineProps<{
  rect: Rect
  can: Record<MoveDir, boolean>
  /** Canvas zoom; the bar counter-scales so it stays readable. */
  zoom: number
}>()
const emit = defineEmits<{ move: [dir: MoveDir]; duplicate: []; remove: [] }>()
const { t } = useI18n()

const DIRS = [
  ['up', ArrowUp],
  ['down', ArrowDown],
  ['left', ArrowLeft],
  ['right', ArrowRight],
] as const

/** Zero-size anchor at the block's top-right corner; the bar hangs off it. */
const anchor = computed(() => ({
  left: `${props.rect.x + props.rect.width}px`,
  top: `${props.rect.y}px`,
}))
/** Too close to the frame's top edge: sit inside the block instead of above it. */
const inside = computed(() => props.rect.y < 40)
</script>

<template>
  <div class="absolute z-20 size-0" :style="anchor">
    <div
      :style="{ zoom: 1 / (zoom || 1) }"
      :class="inside ? 'top-1 right-1' : 'right-0 bottom-1.5'"
      class="absolute flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-card"
      role="toolbar"
      @click.stop
      @pointerdown.stop
    >
      <button
        v-for="[d, icon] in DIRS"
        :key="d"
        type="button"
        class="grid size-6 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg disabled:opacity-30"
        :disabled="!can[d]"
        :title="t(`interface.canvas.move.${d}`)"
        :aria-label="t(`interface.canvas.move.${d}`)"
        @click="emit('move', d)"
      >
        <component :is="icon" :size="13" />
      </button>
      <span class="mx-0.5 h-4 w-px bg-line" />
      <button
        type="button"
        class="grid size-6 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"
        :title="t('interface.canvas.duplicate')"
        :aria-label="t('interface.canvas.duplicate')"
        @click="emit('duplicate')"
      >
        <Copy :size="13" />
      </button>
      <button
        type="button"
        class="grid size-6 place-items-center rounded-md text-danger hover:bg-danger-bg"
        :title="t('interface.canvas.delete')"
        :aria-label="t('interface.canvas.delete')"
        @click="emit('remove')"
      >
        <Trash2 :size="13" />
      </button>
    </div>
  </div>
</template>
