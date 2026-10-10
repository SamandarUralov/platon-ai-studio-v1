<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ icon?: Component; title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
    <div v-if="icon" class="mb-1 grid size-11 place-items-center rounded-xl bg-subtle text-muted">
      <component :is="icon" :size="20" />
    </div>
    <div class="text-lg font-bold">{{ title }}</div>
    <p v-if="description" class="max-w-sm text-base leading-relaxed text-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2 flex gap-2"><slot /></div>
  </div>
</template>
