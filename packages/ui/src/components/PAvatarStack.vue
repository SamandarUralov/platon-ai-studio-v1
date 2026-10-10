<script setup lang="ts">
import PAvatar from './PAvatar.vue'

withDefaults(defineProps<{ people: { name: string; title?: string }[]; max?: number; size?: number }>(), {
  max: 4,
  size: 30,
})
</script>

<template>
  <div class="flex">
    <PAvatar
      v-for="(p, i) in people.slice(0, max)"
      :key="p.name"
      :name="p.name"
      :title="p.title"
      :size="size"
      ring
      :style="{ marginLeft: i ? '-8px' : '0' }"
    />
    <span
      v-if="people.length > max"
      class="-ml-2 grid place-items-center rounded-full border-2 border-surface bg-subtle text-2xs font-bold text-muted"
      :style="{ width: `${size}px`, height: `${size}px` }"
      >+{{ people.length - max }}</span
    >
  </div>
</template>
