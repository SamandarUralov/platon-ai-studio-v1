<script setup lang="ts" generic="T extends string">
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxItem,
  ComboboxEmpty,
} from 'reka-ui'
import { ChevronDown } from 'lucide-vue-next'
import { cn } from '../utils/cn'

export interface ComboOption<V> {
  value: V
  label: string
  hint?: string
}

const props = withDefaults(
  defineProps<{
    options: ComboOption<T>[]
    placeholder?: string
    emptyText?: string
    mono?: boolean
    class?: string
  }>(),
  { emptyText: 'No matches' },
)
const model = defineModel<T>()
const display = (v: unknown) => props.options.find((o) => o.value === v)?.label ?? String(v ?? '')
</script>

<template>
  <ComboboxRoot v-model="model" :class="cn('relative', props.class)">
    <ComboboxAnchor
      class="flex h-[34px] w-full items-center rounded-[9px] border border-line bg-surface pr-1 focus-within:border-primary focus-within:shadow-focus"
    >
      <ComboboxInput
        :display-value="display"
        :placeholder="placeholder"
        :class="
          cn(
            'h-full min-w-0 flex-1 bg-transparent px-2.5 text-base outline-none placeholder:text-faint-2',
            mono && 'font-mono text-sm',
          )
        "
      />
      <ComboboxTrigger class="grid size-6 place-items-center text-faint"
        ><ChevronDown :size="14"
      /></ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="4"
        class="z-50 max-h-72 min-w-[var(--reka-combobox-trigger-width)] overflow-auto rounded-xl border border-line bg-surface p-1 shadow-pop scroll-thin"
      >
        <ComboboxViewport>
          <ComboboxEmpty class="px-2 py-3 text-center text-sm text-faint">{{ emptyText }}</ComboboxEmpty>
          <ComboboxItem
            v-for="o in options"
            :key="o.value"
            :value="o.value"
            class="flex h-8 cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-2 text-base outline-none data-[highlighted]:bg-hover data-[state=checked]:text-primary-strong"
          >
            <span :class="mono ? 'font-mono text-sm' : ''">{{ o.label }}</span>
            <span v-if="o.hint" class="text-xs text-faint">{{ o.hint }}</span>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
