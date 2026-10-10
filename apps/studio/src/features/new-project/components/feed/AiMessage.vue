<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'

defineProps<{ text?: string }>()
</script>

<template>
  <div class="flex gap-3">
    <div class="grid size-7 shrink-0 place-items-center rounded-[9px] bg-ink text-on-ink" aria-hidden="true">
      <Sparkles :size="13" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-3 pt-1">
      <p v-if="text" class="text-pretty text-[14.5px] leading-relaxed">{{ text }}</p>
      <slot />
    </div>
  </div>
</template>
