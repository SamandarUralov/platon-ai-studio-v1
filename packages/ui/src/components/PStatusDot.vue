<script setup lang="ts">
import { cn } from '../utils/cn'
import { toneClasses, type Tone } from '../utils/tone'

const props = withDefaults(defineProps<{ tone?: Tone; pulse?: boolean; size?: number; class?: string }>(), {
  tone: 'ok',
  size: 6,
})
</script>

<template>
  <span
    :class="
      cn('inline-block shrink-0 rounded-full', toneClasses[tone].dot, pulse && 'animate-pulse', props.class)
    "
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>
