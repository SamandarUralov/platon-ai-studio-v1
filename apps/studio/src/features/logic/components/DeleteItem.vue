<script setup lang="ts">
/** "Delete function/API/…" button with a confirmation dialog. */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import { PButton, PDialog } from '@platon/ui'

const props = defineProps<{ name: string; noun: string; usedBy?: number }>()
const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()
const open = ref(false)
</script>

<template>
  <div class="px-4 py-4">
    <PButton variant="danger" :icon="Trash2" @click="open = true">{{
      t('logic.deleteItem', { kind: noun })
    }}</PButton>
    <PDialog
      v-model:open="open"
      :title="t('logic.confirmDelete.title', { name: props.name })"
      :description="usedBy ? t('logic.confirmDelete.used', { n: usedBy }) : t('logic.confirmDelete.body')"
      :width="420"
    >
      <template #footer>
        <PButton @click="open = false">{{ t('logic.cancel') }}</PButton>
        <PButton variant="danger-solid" @click="((open = false), emit('confirm'))">{{
          t('logic.delete')
        }}</PButton>
      </template>
    </PDialog>
  </div>
</template>
