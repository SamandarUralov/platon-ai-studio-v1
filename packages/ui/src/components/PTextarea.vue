<script setup lang="ts">
import { cn } from '../utils/cn'

const props = defineProps<{ invalid?: boolean; mono?: boolean; class?: string }>()
const model = defineModel<string>()
</script>

<template>
  <textarea
    v-model="model"
    :aria-invalid="invalid || undefined"
    :class="
      cn(
        'w-full rounded-[9px] border border-line bg-surface px-2.5 py-2 text-base leading-relaxed text-fg outline-none placeholder:text-faint-2',
        'resize-y focus:border-primary focus:shadow-focus',
        mono && 'font-mono text-sm',
        invalid && 'border-danger-dot',
        props.class,
      )
    "
  />
</template>
