<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../utils/cn'

const PALETTE = [
  ['#ffe2d1', '#9a4a1c'],
  ['#e5f6ec', '#1c7a45'],
  ['#dff1ff', '#1f6f99'],
  ['#f3ecff', '#6b3fc9'],
  ['#fff3df', '#9a5b00'],
  ['#eef0ff', '#3f4bd8'],
  ['#ffe9e7', '#b42318'],
  ['#e3f5ef', '#0e7c66'],
] as const

const props = withDefaults(
  defineProps<{ name: string; size?: number; ring?: boolean; title?: string; class?: string }>(),
  { size: 30 },
)

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join(''),
)
// Stable colour per name so the same person always looks the same.
const colors = computed(() => {
  let h = 0
  for (const ch of props.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]!
})
</script>

<template>
  <span
    :title="title ?? name"
    :class="
      cn(
        'inline-grid shrink-0 place-items-center rounded-full font-bold',
        ring && 'border-2 border-surface',
        props.class,
      )
    "
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.37)}px`,
      background: colors[0],
      color: colors[1],
    }"
    >{{ initials }}</span
  >
</template>
