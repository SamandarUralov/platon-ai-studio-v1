<script setup lang="ts">
/** Engine mark: lucide icon on the engine's tone (no bitmap logos in the UI kit). */
import { computed } from 'vue'
import { cn, PIcon, toneClasses } from '@platon/ui'
import { ENGINES, type DbEngine } from '@platon/definition'

const props = withDefaults(defineProps<{ engine: DbEngine; size?: 'sm' | 'md' | 'lg'; class?: string }>(), {
  size: 'md',
})
const meta = computed(() => ENGINES[props.engine])
const box = { sm: 'size-[22px] rounded-md', md: 'size-[26px] rounded-[7px]', lg: 'size-10 rounded-[10px]' }
const icon = { sm: 12, md: 14, lg: 20 }
</script>

<template>
  <span
    :class="
      cn(
        'grid shrink-0 place-items-center',
        box[size],
        toneClasses[meta.tone].bg,
        toneClasses[meta.tone].fg,
        props.class,
      )
    "
    :title="meta.label"
  >
    <PIcon :name="meta.icon" :size="icon[size]" />
  </span>
</template>
