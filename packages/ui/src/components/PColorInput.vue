<script setup lang="ts">
import { cn } from '../utils/cn'

withDefaults(defineProps<{ swatches?: string[]; class?: string }>(), {
  swatches: () => ['#4f5bea', '#2a2c3f', '#0e7c66', '#d9541e', '#0a7bbf', '#8a3fb8', '#f5a524', '#d64545'],
})
const model = defineModel<string>({ default: '#4f5bea' })
</script>

<template>
  <div :class="cn('flex flex-wrap items-center gap-1.5', $props.class)">
    <button
      v-for="c in swatches"
      :key="c"
      type="button"
      :title="c"
      :aria-label="`Colour ${c}`"
      :aria-pressed="model.toLowerCase() === c.toLowerCase()"
      class="size-6 rounded-full border-2 transition-transform hover:scale-110"
      :class="
        model.toLowerCase() === c.toLowerCase()
          ? 'border-fg'
          : 'border-surface shadow-[0_0_0_1px_var(--p-line)]'
      "
      :style="{ background: c }"
      @click="model = c"
    />
    <label class="ml-1 flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface pl-1 pr-2">
      <input
        v-model="model"
        type="color"
        class="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
        aria-label="Custom colour"
      />
      <span class="font-mono text-xs text-muted">{{ model }}</span>
    </label>
  </div>
</template>
