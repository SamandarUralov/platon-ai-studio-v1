<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ArrowLeft, History, SquarePen } from 'lucide-vue-next'
import { PButton, cn } from '@platon/ui'

defineProps<{ title: string; historyOpen: boolean }>()
defineEmits<{ toggleHistory: []; newChat: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex h-11 shrink-0 items-center gap-1.5 border-b border-line-faint bg-surface pr-2 pl-3.5">
    <PButton
      v-if="historyOpen"
      variant="ghost"
      size="xs"
      square
      :icon="ArrowLeft"
      :label="t('ai.backToChat')"
      class="-ml-1.5"
      @click="$emit('toggleHistory')"
    />
    <div class="min-w-0 flex-1 truncate text-base font-bold text-fg">
      {{ historyOpen ? t('ai.historyTitle') : title }}
    </div>
    <PButton
      variant="ghost"
      size="xs"
      :icon="History"
      :aria-pressed="historyOpen"
      :class="cn(historyOpen && 'bg-primary-tint text-primary-strong hover:bg-primary-tint')"
      @click="$emit('toggleHistory')"
    >
      {{ t('ai.history') }}
    </PButton>
    <PButton
      variant="ghost"
      size="xs"
      square
      :icon="SquarePen"
      :label="t('ai.newChat')"
      @click="$emit('newChat')"
    />
  </div>
</template>
