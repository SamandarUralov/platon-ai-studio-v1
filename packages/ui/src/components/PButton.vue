<script setup lang="ts">
import { computed, type Component } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'
import PSpinner from './PSpinner.vue'

const button = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-accent hover:bg-primary-hover border border-transparent font-bold',
        ink: 'bg-ink text-on-ink hover:bg-ink-hover border border-transparent',
        outline: 'bg-surface text-fg border border-line hover:bg-hover',
        ghost: 'bg-transparent text-fg-2 border border-transparent hover:bg-hover',
        subtle: 'bg-subtle text-fg-2 border border-transparent hover:bg-line-soft',
        tint: 'bg-primary-tint text-primary-strong border border-transparent hover:bg-primary-soft',
        danger: 'bg-surface text-danger border border-line hover:bg-danger-bg',
        'danger-solid': 'bg-danger-dot text-white border border-transparent hover:opacity-90',
        ai: 'bg-ai-bg text-ai border border-transparent hover:opacity-90',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-[7px]',
        sm: 'h-8 px-3 text-sm rounded-lg',
        md: 'h-[34px] px-3.5 text-base rounded-[9px]',
        lg: 'h-[38px] px-4 text-lg rounded-[10px]',
      },
      square: { true: 'px-0', false: '' },
    },
    compoundVariants: [
      { square: true, size: 'xs', class: 'w-7' },
      { square: true, size: 'sm', class: 'w-8' },
      { square: true, size: 'md', class: 'w-[34px]' },
      { square: true, size: 'lg', class: 'w-[38px]' },
    ],
    defaultVariants: { variant: 'outline', size: 'sm', square: false },
  },
)

type ButtonVariants = VariantProps<typeof button>

const props = withDefaults(
  defineProps<{
    variant?: NonNullable<ButtonVariants['variant']>
    size?: NonNullable<ButtonVariants['size']>
    icon?: Component
    iconRight?: Component
    /** Square icon-only button; pass `label` for accessibility. */
    square?: boolean
    label?: string
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    class?: string
  }>(),
  { variant: 'outline', size: 'sm', type: 'button', square: false },
)

const iconSize = computed(() => ({ xs: 13, sm: 14, md: 15, lg: 15 })[props.size])
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-label="square ? label : undefined"
    :title="square ? label : undefined"
    :class="cn(button({ variant, size, square }), props.class)"
  >
    <PSpinner v-if="loading" :size="iconSize" />
    <component :is="icon" v-else-if="icon" :size="iconSize" :stroke-width="2" aria-hidden="true" />
    <slot />
    <component :is="iconRight" v-if="iconRight" :size="iconSize" :stroke-width="2" aria-hidden="true" />
  </button>
</template>
