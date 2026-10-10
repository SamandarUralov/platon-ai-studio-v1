<script setup lang="ts">
import { ref } from 'vue'
import { Copy } from 'lucide-vue-next'
import { PButton, PDialog, PField, PInput } from '@platon/ui'
import type { ProjectSummary } from '@platon/definition'

const props = defineProps<{ project: ProjectSummary; busy?: boolean }>()
const emit = defineEmits<{ close: []; confirm: [name: string] }>()
const open = ref(true)
const name = ref(`${props.project.name} (copy)`)
</script>

<template>
  <PDialog
    v-model:open="open"
    title="Duplicate app"
    :description="`Copies pages, logic, data model and settings of ${project.name}. Records, files and run history stay behind.`"
    :icon="Copy"
    @update:open="(o) => !o && emit('close')"
  >
    <PField label="Name" required>
      <template #default="{ id }"
        ><PInput
          :id="id"
          v-model="name"
          autofocus
          @keydown.enter="name.trim() && emit('confirm', name.trim())"
      /></template>
    </PField>
    <template #footer>
      <PButton @click="emit('close')">Cancel</PButton>
      <PButton
        variant="primary"
        :loading="busy"
        :disabled="!name.trim()"
        @click="emit('confirm', name.trim())"
        >Duplicate</PButton
      >
    </template>
  </PDialog>
</template>
