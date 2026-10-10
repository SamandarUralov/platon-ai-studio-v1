<script setup lang="ts">
/** Small labelled value tile (endpoint, region, free space…). */
import type { Component } from 'vue'

defineProps<{ label: string; value: string; icon?: Component; mono?: boolean }>()
</script>

<template>
  <div class="min-w-0 rounded-xl border border-line-2 bg-surface px-4 py-3">
    <div class="flex items-center gap-1.5 text-sm font-semibold text-muted">
      <component :is="icon" v-if="icon" :size="13" aria-hidden="true" />
      {{ label }}
    </div>
    <div class="mt-1.5 truncate text-lg font-bold" :class="mono && 'font-mono text-md'" :title="value">
      <slot>{{ value }}</slot>
    </div>
  </div>
</template>
