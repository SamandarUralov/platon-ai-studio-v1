<script setup lang="ts">
/** Header row used at the top of side panels. */
defineProps<{ title: string; sub?: string }>()
</script>

<template>
  <div class="flex h-12 shrink-0 items-center gap-2 border-b border-line-faint px-3.5">
    <div class="min-w-0 flex-1">
      <div class="truncate text-md font-bold">{{ title }}</div>
      <div v-if="sub" class="truncate text-xs text-faint">{{ sub }}</div>
    </div>
    <slot />
  </div>
</template>
