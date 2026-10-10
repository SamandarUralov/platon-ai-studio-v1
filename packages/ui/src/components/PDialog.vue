<script setup lang="ts">
import type { Component } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '../utils/cn'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: Component
    width?: number
    class?: string
    bodyClass?: string
  }>(),
  { width: 520 },
)
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-overlay" />
      <DialogContent
        :style="{ width: `min(${width}px, calc(100vw - 32px))` }"
        :class="
          cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-48px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-line bg-surface shadow-modal outline-none animate-rise',
            props.class,
          )
        "
      >
        <header class="flex items-start gap-3 px-5 pb-3 pt-5">
          <div
            v-if="icon"
            class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-tint text-primary-strong"
          >
            <component :is="icon" :size="17" />
          </div>
          <div class="min-w-0 flex-1">
            <DialogTitle class="m-0 text-lg font-bold">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-0.5 text-base text-muted">{{
              description
            }}</DialogDescription>
          </div>
          <DialogClose
            class="grid size-7 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg"
            aria-label="Close"
          >
            <X :size="16" />
          </DialogClose>
        </header>
        <div :class="cn('min-h-0 flex-1 overflow-auto px-5 pb-4 scroll-thin', bodyClass)"><slot /></div>
        <footer
          v-if="$slots.footer"
          class="flex items-center justify-end gap-2 border-t border-line-faint px-5 py-3"
        >
          <slot name="footer" :close="() => (open = false)" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
