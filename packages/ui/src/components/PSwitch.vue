<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{ disabled?: boolean; label?: string; size?: 'sm' | 'md' }>()
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <SwitchRoot
    v-model="model"
    :disabled="disabled"
    :aria-label="label"
    :class="[
      'relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-line',
      size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
    ]"
  >
    <SwitchThumb
      :class="[
        'block rounded-full bg-white shadow-xs transition-transform',
        size === 'sm'
          ? 'size-3 translate-x-0.5 data-[state=checked]:translate-x-3.5'
          : 'size-4 translate-x-0.5 data-[state=checked]:translate-x-[18px]',
      ]"
    />
  </SwitchRoot>
</template>
