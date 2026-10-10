<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { PIcon, cn } from '@platon/ui'
import type { AiChip } from '@platon/definition'

defineProps<{ chip: Pick<AiChip, 'kind' | 'label' | 'icon'>; removable?: boolean; removeLabel?: string }>()
defineEmits<{ remove: [] }>()
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex h-6 max-w-full items-center gap-1.5 rounded-[7px] pl-2 text-xs font-semibold',
        removable ? 'pr-0.5' : 'pr-2',
        chip.kind === 'skill' ? 'bg-primary-tint text-primary-strong' : 'bg-teal-bg text-teal',
      )
    "
  >
    <PIcon :name="chip.icon" :size="12" class="shrink-0" />
    <span class="truncate">{{ chip.label }}</span>
    <button
      v-if="removable"
      type="button"
      :aria-label="removeLabel"
      :title="removeLabel"
      class="grid size-[18px] shrink-0 place-items-center rounded-[5px] opacity-70 hover:bg-surface/60 hover:opacity-100"
      @click="$emit('remove')"
    >
      <X :size="12" />
    </button>
  </span>
</template>
