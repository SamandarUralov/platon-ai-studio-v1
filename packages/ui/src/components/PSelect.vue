<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
} from 'reka-ui'
import { Check, ChevronDown } from 'lucide-vue-next'
import { cn } from '../utils/cn'

export interface SelectOption<V> {
  value: V
  label: string
  icon?: Component
  description?: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    options: SelectOption<T>[]
    placeholder?: string
    size?: 'sm' | 'md'
    disabled?: boolean
    class?: string
    ariaLabel?: string
  }>(),
  { size: 'md' },
)
const model = defineModel<T>()
</script>

<template>
  <SelectRoot v-model="model" :disabled="disabled">
    <SelectTrigger
      :aria-label="ariaLabel"
      :class="
        cn(
          'inline-flex w-full items-center justify-between gap-2 rounded-[9px] border border-line bg-surface px-2.5 text-left text-fg outline-none',
          'focus:border-primary focus:shadow-focus data-[placeholder]:text-faint-2 disabled:bg-subtle',
          size === 'sm' ? 'h-[30px] text-sm' : 'h-[34px] text-base',
          props.class,
        )
      "
    >
      <SelectValue :placeholder="placeholder" class="truncate" />
      <SelectIcon><ChevronDown :size="14" class="text-faint" /></SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        class="z-50 max-h-72 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop"
      >
        <SelectViewport>
          <SelectItem
            v-for="o in options"
            :key="o.value"
            :value="o.value"
            :disabled="o.disabled"
            class="relative flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-lg py-1.5 pl-2 pr-7 text-base outline-none data-[highlighted]:bg-hover data-[disabled]:opacity-50"
          >
            <component :is="o.icon" v-if="o.icon" :size="14" class="text-muted" />
            <div class="min-w-0">
              <SelectItemText>{{ o.label }}</SelectItemText>
              <div v-if="o.description" class="text-xs text-faint">{{ o.description }}</div>
            </div>
            <SelectItemIndicator class="absolute right-2"
              ><Check :size="14" class="text-primary"
            /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
