<script setup lang="ts">
defineProps<{ label: string; count?: number | string }>()
</script>

<template>
  <div class="flex h-8 items-center gap-1.5 px-3.5">
    <span class="eyebrow">{{ label }}</span>
    <span v-if="count !== undefined" class="text-2xs font-bold text-faint-2">{{ count }}</span>
    <div class="ml-auto flex items-center gap-1"><slot /></div>
  </div>
</template>
