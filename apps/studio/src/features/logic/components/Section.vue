<script setup lang="ts">
/** Collapsible settings section with a one-line summary when closed (API / function settings). */
import { ChevronDown } from 'lucide-vue-next'

defineProps<{ title: string; summary?: string }>()
const open = defineModel<boolean>('open', { default: true })
</script>

<template>
  <section class="border-b border-line-faint">
    <button
      type="button"
      class="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-hover"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="min-w-0 flex-1">
        <span class="block text-md font-bold text-fg">{{ title }}</span>
        <span v-if="summary && !open" class="block truncate font-mono text-xs text-faint">{{ summary }}</span>
      </span>
      <slot name="actions" />
      <ChevronDown :size="15" class="text-faint transition-transform" :class="open ? '' : '-rotate-90'" />
    </button>
    <div v-if="open" class="flex flex-col gap-3 px-4 pb-4"><slot /></div>
  </section>
</template>
