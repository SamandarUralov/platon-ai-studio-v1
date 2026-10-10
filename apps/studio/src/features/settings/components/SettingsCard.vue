<script setup lang="ts">
/** White card used for every settings group; optional header with title, description and actions. */
import { cn } from '@platon/ui'

const props = defineProps<{
  title?: string
  description?: string
  tone?: 'danger'
  class?: string
  bodyClass?: string
}>()
</script>

<template>
  <section
    :class="
      cn(
        'overflow-hidden rounded-[14px] border bg-surface',
        tone === 'danger' ? 'border-danger/30' : 'border-line-2',
        props.class,
      )
    "
  >
    <header
      v-if="title || $slots.actions"
      class="flex flex-wrap items-center gap-3 border-b px-[18px] py-3.5"
      :class="tone === 'danger' ? 'border-danger/20' : 'border-line-faint'"
    >
      <div class="min-w-[200px] flex-1">
        <h2 class="text-lg font-bold" :class="tone === 'danger' ? 'text-danger' : ''">{{ title }}</h2>
        <p v-if="description" class="mt-0.5 text-sm text-muted">{{ description }}</p>
      </div>
      <slot name="actions" />
    </header>
    <div :class="bodyClass"><slot /></div>
  </section>
</template>
