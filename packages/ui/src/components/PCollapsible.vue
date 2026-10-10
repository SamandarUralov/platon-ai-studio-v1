<script setup lang="ts">
import type { Component } from 'vue'
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui'
import { ChevronRight } from 'lucide-vue-next'

defineProps<{ title: string; icon?: Component; count?: number | string; dense?: boolean }>()
const open = defineModel<boolean>('open', { default: true })
</script>

<template>
  <CollapsibleRoot v-model:open="open" class="border-b border-line-faint last:border-b-0">
    <div class="flex items-center gap-1 pr-2">
      <CollapsibleTrigger
        :class="[
          'group flex flex-1 items-center gap-1.5 text-left font-bold text-fg',
          dense ? 'h-8 px-2 text-sm' : 'h-10 px-3.5 text-base',
        ]"
      >
        <ChevronRight :size="14" class="text-faint transition-transform group-data-[state=open]:rotate-90" />
        <component :is="icon" v-if="icon" :size="14" class="text-muted" />
        <span class="truncate">{{ title }}</span>
        <span v-if="count !== undefined" class="text-xs font-semibold text-faint">{{ count }}</span>
      </CollapsibleTrigger>
      <slot name="actions" />
    </div>
    <CollapsibleContent :class="dense ? 'pb-1' : 'px-3.5 pb-3.5'">
      <slot />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
