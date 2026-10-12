<script setup lang="ts">
/**
 * Right-edge handle of the selected block, drawn by Studio over the Sandbox iframe like the block
 * toolbar. Dragging snaps the width to whole columns of the 12-column grid; the change is applied
 * once on release (each apply re-renders the Sandbox, so live updates would stutter). While
 * dragging, a dashed outline and an "n / 12" label preview the result. ← / → resize by one column.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Rect } from '@platon/bridge/sandbox'
import { ROW_GAP, spanFromDrag } from '../lib/blocks'

const props = defineProps<{
  rect: Rect
  /** Columns the block takes now. */
  span: number
  /** Most columns it can take (its neighbours keep one each). */
  max: number
  /** Canvas zoom: pointer deltas are screen pixels, the rect is in iframe pixels. */
  zoom: number
}>()
const emit = defineEmits<{ resize: [span: number] }>()
const { t } = useI18n()

const preview = ref<number | null>(null)
const shown = computed(() => preview.value ?? props.span)
/** Width the block would have at `shown` columns, from the column width it has now. */
const ghostWidth = computed(() => {
  const col = (props.rect.width - (props.span - 1) * ROW_GAP) / props.span
  return shown.value * col + (shown.value - 1) * ROW_GAP
})

function onPointerDown(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const x0 = e.clientX
  const z = props.zoom || 1
  preview.value = props.span
  const move = (ev: PointerEvent) => {
    preview.value = Math.min(props.max, spanFromDrag(props.rect.width, props.span, (ev.clientX - x0) / z))
  }
  const end = (apply: boolean) => () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', cancel)
    if (apply && preview.value !== null && preview.value !== props.span) emit('resize', preview.value)
    preview.value = null
  }
  const up = end(true)
  // An interrupted gesture (touch cancel, system dialog) throws the preview away.
  const cancel = end(false)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', cancel)
}

function onKey(e: KeyboardEvent) {
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!d) return
  e.preventDefault()
  const next = Math.min(props.max, Math.max(1, props.span + d))
  if (next !== props.span) emit('resize', next)
}
</script>

<template>
  <div
    v-if="preview !== null"
    class="pointer-events-none absolute z-20 rounded-[10px] border-2 border-dashed border-primary"
    :style="{
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${ghostWidth}px`,
      height: `${rect.height}px`,
    }"
  />
  <div
    class="absolute z-20 flex w-0 items-center justify-center"
    :style="{ left: `${rect.x + rect.width}px`, top: `${rect.y}px`, height: `${rect.height}px` }"
  >
    <button
      type="button"
      role="slider"
      :aria-label="t('interface.canvas.resize')"
      :aria-valuemin="1"
      :aria-valuemax="max"
      :aria-valuenow="shown"
      :aria-valuetext="t('interface.canvas.columns', { n: shown })"
      :title="t('interface.canvas.resize')"
      :style="{ zoom: 1 / (zoom || 1) }"
      class="h-8 w-2 shrink-0 cursor-ew-resize touch-none rounded-full border border-surface bg-primary shadow-card outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      @pointerdown.stop.prevent="onPointerDown"
      @click.stop
      @keydown="onKey"
    />
    <span
      v-if="preview !== null"
      :style="{ zoom: 1 / (zoom || 1) }"
      class="absolute top-1/2 left-3 -translate-y-1/2 rounded-md bg-ink px-1.5 py-0.5 font-mono text-xs font-medium whitespace-nowrap text-on-ink shadow-pop"
    >
      {{ t('interface.canvas.columns', { n: shown }) }}
    </span>
  </div>
</template>
