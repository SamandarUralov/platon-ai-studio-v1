<script setup lang="ts" generic="T extends string | number">
import type { Component } from 'vue'
import { cn } from '../utils/cn'

export interface SegmentOption<V> {
  value: V
  label?: string
  icon?: Component
  title?: string
  badge?: string | number
}

const props = withDefaults(
  defineProps<{
    options: SegmentOption<T>[]
    size?: 'sm' | 'md'
    block?: boolean
    class?: string
    ariaLabel?: string
  }>(),
  { size: 'sm' },
)
const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="ariaLabel"
    :class="cn('inline-flex gap-0.5 rounded-[10px] bg-subtle p-[3px]', block && 'flex w-full', props.class)"
  >
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      role="radio"
      :aria-checked="model === o.value"
      :title="o.title ?? o.label"
      :class="
        cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 font-semibold whitespace-nowrap transition-colors',
          size === 'sm' ? 'h-7 text-sm' : 'h-8 text-base',
          block && 'flex-1',
          model === o.value ? 'bg-surface text-fg shadow-seg' : 'text-muted hover:text-fg',
        )
      "
      @click="model = o.value"
    >
      <component :is="o.icon" v-if="o.icon" :size="14" aria-hidden="true" />
      <span v-if="o.label">{{ o.label }}</span>
      <span
        v-if="o.badge !== undefined"
        class="rounded-full bg-primary-tint px-1.5 text-2xs font-bold text-primary-strong"
        >{{ o.badge }}</span
      >
    </button>
  </div>
</template>
