<script setup lang="ts">
import type { Component } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from 'reka-ui'
import { cn } from '../utils/cn'
import PKbd from './PKbd.vue'

export type MenuEntry =
  | {
      type?: 'item'
      label: string
      icon?: Component
      shortcut?: string
      danger?: boolean
      disabled?: boolean
      onSelect: () => void
    }
  | { type: 'separator' }
  | { type: 'label'; label: string }

const props = withDefaults(
  defineProps<{
    items: MenuEntry[]
    align?: 'start' | 'center' | 'end'
    side?: 'top' | 'bottom' | 'left' | 'right'
    width?: number
    class?: string
  }>(),
  { align: 'end', side: 'bottom', width: 220 },
)
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child><slot /></DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :align="align"
        :side="side"
        :side-offset="6"
        :collision-padding="8"
        :style="{ width: `${width}px` }"
        :class="
          cn('z-50 rounded-xl border border-line bg-surface p-1.5 shadow-pop outline-none', props.class)
        "
      >
        <slot name="header" />
        <template v-for="(it, i) in items" :key="i">
          <DropdownMenuSeparator v-if="it.type === 'separator'" class="my-1 h-px bg-line-faint" />
          <DropdownMenuLabel v-else-if="it.type === 'label'" class="eyebrow px-2 pb-1 pt-1.5">{{
            it.label
          }}</DropdownMenuLabel>
          <DropdownMenuItem
            v-else
            :disabled="it.disabled"
            :class="
              cn(
                'flex h-8 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 text-base outline-none',
                'data-[highlighted]:bg-hover data-[disabled]:cursor-default data-[disabled]:opacity-50',
                it.danger ? 'text-danger' : 'text-fg',
              )
            "
            @select="it.onSelect()"
          >
            <component :is="it.icon" v-if="it.icon" :size="15" :class="it.danger ? '' : 'text-muted'" />
            <span class="flex-1 truncate">{{ it.label }}</span>
            <PKbd v-if="it.shortcut">{{ it.shortcut }}</PKbd>
          </DropdownMenuItem>
        </template>
        <slot name="footer" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
