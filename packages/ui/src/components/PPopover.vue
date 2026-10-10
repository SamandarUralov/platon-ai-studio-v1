<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent, PopoverAnchor } from 'reka-ui'
import { cn } from '../utils/cn'

const props = withDefaults(
  defineProps<{
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    sideOffset?: number
    width?: number | string
    class?: string
    /** Render the trigger slot as-is (no wrapper). */
    asChild?: boolean
  }>(),
  { side: 'bottom', align: 'start', sideOffset: 6, asChild: true },
)
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger v-if="$slots.trigger" :as-child="asChild"><slot name="trigger" /></PopoverTrigger>
    <PopoverAnchor v-if="$slots.anchor" as-child><slot name="anchor" /></PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :collision-padding="8"
        :style="{ width: typeof width === 'number' ? `${width}px` : width }"
        :class="
          cn(
            'z-50 max-h-[var(--reka-popover-content-available-height)] overflow-auto rounded-[14px] border border-line bg-surface text-fg shadow-pop outline-none scroll-thin',
            props.class,
          )
        "
      >
        <slot :close="() => (open = false)" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
