<script setup lang="ts">
import { TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent } from 'reka-ui'

withDefaults(
  defineProps<{ text?: string; side?: 'top' | 'right' | 'bottom' | 'left'; disabled?: boolean }>(),
  {
    side: 'top',
  },
)
</script>

<template>
  <TooltipRoot :disabled="disabled || (!text && !$slots.content)" :delay-duration="350">
    <TooltipTrigger as-child><slot /></TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="6"
        class="z-[60] max-w-xs rounded-lg bg-ink px-2 py-1 text-xs font-medium text-on-ink shadow-pop"
      >
        <slot name="content">{{ text }}</slot>
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
