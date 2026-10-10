<script setup lang="ts">
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui'
import { Check, Minus } from 'lucide-vue-next'

defineProps<{ disabled?: boolean; label?: string }>()
const model = defineModel<boolean | 'indeterminate'>({ default: false })
</script>

<template>
  <label class="inline-flex items-center gap-2 text-base" :class="disabled ? 'opacity-50' : 'cursor-pointer'">
    <CheckboxRoot
      v-model="model"
      :disabled="disabled"
      class="grid size-4 shrink-0 place-items-center rounded-[5px] border border-line bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary"
    >
      <CheckboxIndicator class="text-white">
        <Minus v-if="model === 'indeterminate'" :size="12" :stroke-width="3" />
        <Check v-else :size="12" :stroke-width="3" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <span v-if="label || $slots.default"
      ><slot>{{ label }}</slot></span
    >
  </label>
</template>
