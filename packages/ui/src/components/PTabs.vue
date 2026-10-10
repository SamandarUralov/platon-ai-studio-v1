<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'
import { cn } from '../utils/cn'

export interface TabItem<V> {
  value: V
  label: string
  icon?: Component
  count?: number | string
  tone?: 'danger' | 'warn'
}

const props = withDefaults(
  defineProps<{ items: TabItem<T>[]; variant?: 'line' | 'pill'; class?: string }>(),
  {
    variant: 'line',
  },
)
const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    role="tablist"
    :class="
      cn(variant === 'line' ? 'flex items-end gap-4 border-b border-line-soft' : 'flex gap-1', props.class)
    "
  >
    <button
      v-for="t in items"
      :key="t.value"
      type="button"
      role="tab"
      :aria-selected="model === t.value"
      :class="
        cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap font-semibold transition-colors',
          variant === 'line'
            ? [
                '-mb-px h-9 border-b-2 text-base',
                model === t.value ? 'border-primary text-fg' : 'border-transparent text-muted hover:text-fg',
              ]
            : [
                'h-7 rounded-[7px] px-2.5 text-sm',
                model === t.value ? 'bg-primary-tint text-primary-strong' : 'text-muted hover:bg-hover',
              ],
        )
      "
      @click="model = t.value"
    >
      <component :is="t.icon" v-if="t.icon" :size="14" aria-hidden="true" />
      {{ t.label }}
      <span
        v-if="t.count !== undefined"
        :class="
          cn(
            'min-w-[18px] rounded-full px-1.5 text-2xs font-bold leading-[18px]',
            t.tone === 'danger'
              ? 'bg-danger-bg text-danger'
              : t.tone === 'warn'
                ? 'bg-warn-bg text-warn'
                : 'bg-subtle text-muted',
          )
        "
        >{{ t.count }}</span
      >
    </button>
    <div class="ml-auto flex items-center gap-2 self-center"><slot name="end" /></div>
  </div>
</template>
