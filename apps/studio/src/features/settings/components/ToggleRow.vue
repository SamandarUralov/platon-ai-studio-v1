<script setup lang="ts">
/** List row with icon, label, description and a switch on the right. */
import type { Component } from 'vue'
import { PSwitch } from '@platon/ui'

defineProps<{ label: string; description?: string; icon?: Component; disabled?: boolean }>()
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <div class="flex items-center gap-3 border-b border-line-faint px-[18px] py-3 last:border-b-0">
    <div v-if="icon" class="grid size-8 shrink-0 place-items-center rounded-lg bg-subtle text-fg-2">
      <component :is="icon" :size="15" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="text-md font-semibold">{{ label }}</div>
      <div v-if="description" class="mt-0.5 text-sm text-muted">{{ description }}</div>
    </div>
    <slot />
    <PSwitch v-model="model" :label="label" :disabled="disabled" />
  </div>
</template>
