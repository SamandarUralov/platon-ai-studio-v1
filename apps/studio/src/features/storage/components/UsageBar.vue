<script setup lang="ts">
/** Used/limit meter. Turns warn-coloured at WARN_PCT; unlimited totals show an empty track. */
import { computed } from 'vue'
import { isNearFull, usagePct } from '../utils'

const props = withDefaults(
  defineProps<{ used: number; total: number; size?: 'sm' | 'md'; label?: string }>(),
  { size: 'md' },
)
const pct = computed(() => usagePct(props.used, props.total))
const warn = computed(() => isNearFull(props.used, props.total))
</script>

<template>
  <div
    role="meter"
    :aria-label="label"
    :aria-valuenow="pct"
    aria-valuemin="0"
    aria-valuemax="100"
    class="overflow-hidden rounded-full bg-line-soft"
    :class="size === 'sm' ? 'h-[5px]' : 'h-2'"
  >
    <div
      class="h-full rounded-full transition-[width] duration-300"
      :class="warn ? 'bg-warn-dot' : 'bg-primary'"
      :style="{ width: `${pct}%` }"
    />
  </div>
</template>
