<script setup lang="ts">
/** Row in a left-panel list (pages, functions, tables...). */
import { PIcon, PStatusDot, type Tone } from '@platon/ui'

defineProps<{
  label: string
  icon?: string
  sub?: string
  active?: boolean
  dirty?: boolean
  status?: Tone | null
  count?: number | string
  depth?: number
}>()
</script>

<template>
  <button
    type="button"
    class="group flex min-h-8 w-full items-center gap-2 rounded-lg py-1 pr-2 text-left text-base"
    :class="active ? 'bg-primary-tint text-primary-strong' : 'text-fg hover:bg-hover'"
    :style="{ paddingLeft: `${8 + (depth ?? 0) * 14}px` }"
  >
    <PIcon v-if="icon" :name="icon" :size="15" :class="active ? '' : 'text-muted'" />
    <span class="min-w-0 flex-1">
      <span class="block truncate font-medium">{{ label }}</span>
      <span
        v-if="sub"
        class="block truncate text-xs"
        :class="active ? 'text-primary-strong/70' : 'text-faint'"
        >{{ sub }}</span
      >
    </span>
    <span v-if="dirty" class="size-1.5 rounded-full bg-warn-dot" title="Unsaved changes" />
    <PStatusDot v-if="status" :tone="status" />
    <span v-if="count !== undefined" class="text-xs text-faint">{{ count }}</span>
    <slot name="actions" />
  </button>
</template>
