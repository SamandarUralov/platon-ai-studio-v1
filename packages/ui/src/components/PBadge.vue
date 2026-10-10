<script setup lang="ts">
import type { Component } from 'vue'
import { cn } from '../utils/cn'
import { toneClasses, type Tone } from '../utils/tone'

const props = withDefaults(
  defineProps<{
    tone?: Tone
    icon?: Component
    dot?: boolean
    size?: 'xs' | 'sm'
    outline?: boolean
    class?: string
  }>(),
  { tone: 'neutral', size: 'sm' },
)
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold',
        size === 'xs' ? 'h-[18px] px-1.5 text-2xs' : 'h-[22px] px-2 text-xs',
        toneClasses[tone].fg,
        outline ? ['border bg-surface', toneClasses[tone].border] : toneClasses[tone].bg,
        props.class,
      )
    "
  >
    <span v-if="dot" :class="cn('size-1.5 rounded-full', toneClasses[tone].dot)" />
    <component :is="icon" v-if="icon" :size="12" aria-hidden="true" />
    <slot />
  </span>
</template>
