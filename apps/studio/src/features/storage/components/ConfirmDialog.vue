<script setup lang="ts">
/** Small destructive-action confirmation used across the Storage layer. */
import { TriangleAlert } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { PButton, PDialog } from '@platon/ui'

defineProps<{ title: string; description?: string; confirmLabel: string; loading?: boolean }>()
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
</script>

<template>
  <PDialog v-model:open="open" :title="title" :description="description" :icon="TriangleAlert" :width="440">
    <slot />
    <template #footer="{ close }">
      <PButton @click="close">{{ t('storage.common.cancel') }}</PButton>
      <PButton variant="danger-solid" :loading="loading" @click="emit('confirm')">{{ confirmLabel }}</PButton>
    </template>
  </PDialog>
</template>
