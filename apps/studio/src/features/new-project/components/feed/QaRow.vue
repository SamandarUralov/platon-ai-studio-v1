<script setup lang="ts">
import { Pencil } from 'lucide-vue-next'
import { PIcon } from '@platon/ui'

defineProps<{ icon: string; question: string; answer: string; editable: boolean; editLabel: string }>()
defineEmits<{ edit: [] }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-3">
      <div
        class="grid size-7 shrink-0 place-items-center rounded-[9px] bg-subtle text-muted"
        aria-hidden="true"
      >
        <PIcon :name="icon" :size="13" />
      </div>
      <div class="text-lg text-muted">{{ question }}</div>
    </div>
    <div class="flex justify-end">
      <button
        type="button"
        :disabled="!editable"
        :title="editable ? editLabel : undefined"
        :aria-label="editable ? `${editLabel}: ${answer}` : undefined"
        class="flex max-w-[80%] items-center gap-2.5 rounded-[16px_16px_4px_16px] border border-line bg-surface py-2.5 pl-4 pr-3 text-left enabled:hover:border-primary disabled:cursor-default"
        @click="$emit('edit')"
      >
        <span class="text-lg font-semibold leading-snug">{{ answer }}</span>
        <Pencil v-if="editable" :size="12" class="shrink-0 text-faint-2" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
