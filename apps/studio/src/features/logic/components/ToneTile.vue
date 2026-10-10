<script setup lang="ts">
/** Square icon tile coloured by a catalog tone (steps, logic kinds). */
import { PIcon, toneClasses, cn, type Tone } from '@platon/ui'

withDefaults(defineProps<{ icon: string; tone: Tone; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
const BOX = { sm: 'size-6 rounded-md', md: 'size-8 rounded-lg', lg: 'size-11 rounded-xl' }
const ICON = { sm: 13, md: 16, lg: 20 }
</script>

<template>
  <span
    :class="cn('grid shrink-0 place-items-center', BOX[size], toneClasses[tone].bg, toneClasses[tone].fg)"
  >
    <PIcon :name="icon" :size="ICON[size]" />
  </span>
</template>
