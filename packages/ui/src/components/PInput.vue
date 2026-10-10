<script setup lang="ts">
import { ref, type Component } from 'vue'
import { cn } from '../utils/cn'

const props = withDefaults(
  defineProps<{
    icon?: Component
    size?: 'sm' | 'md' | 'lg'
    invalid?: boolean
    mono?: boolean
    class?: string
    inputClass?: string
  }>(),
  { size: 'md' },
)
defineOptions({ inheritAttrs: false })
const model = defineModel<string | number | null>()
const el = ref<HTMLInputElement>()
defineExpose({ focus: () => el.value?.focus(), select: () => el.value?.select(), el })

const heights = { sm: 'h-[30px] text-sm', md: 'h-[34px] text-base', lg: 'h-[38px] text-lg' }
</script>

<template>
  <div :class="cn('relative flex items-center', props.class)">
    <component
      :is="icon"
      v-if="icon"
      :size="14"
      class="pointer-events-none absolute left-2.5 text-faint-2"
      aria-hidden="true"
    />
    <input
      ref="el"
      v-model="model"
      v-bind="$attrs"
      :aria-invalid="invalid || undefined"
      :class="
        cn(
          'w-full min-w-0 rounded-[9px] border border-line bg-surface px-2.5 text-fg outline-none transition-shadow placeholder:text-faint-2',
          'focus:border-primary focus:shadow-focus disabled:bg-subtle disabled:text-faint',
          heights[size],
          icon && 'pl-8',
          mono && 'font-mono text-sm',
          invalid && 'border-danger-dot focus:border-danger-dot',
          inputClass,
        )
      "
    />
    <div v-if="$slots.suffix" class="absolute right-1.5 flex items-center gap-1"><slot name="suffix" /></div>
  </div>
</template>
