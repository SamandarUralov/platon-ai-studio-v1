<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ label?: string; hint?: string; error?: string | null; required?: boolean; inline?: boolean }>()
const id = useId()
</script>

<template>
  <div :class="inline ? 'flex items-center justify-between gap-3' : 'flex flex-col gap-1.5'">
    <label v-if="label" :for="id" class="text-sm font-semibold text-fg-2">
      {{ label }}<span v-if="required" class="text-danger"> *</span>
    </label>
    <slot :id="id" />
    <p v-if="error" class="text-xs text-danger">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-faint">{{ hint }}</p>
  </div>
</template>
