<script setup lang="ts">
/** "Unsaved changes · Discard · Save (⌘S)" — shown in headers of draft-based editors. */
import { PButton, PStatusDot } from '@platon/ui'
import { kbd } from '@/composables/useShortcuts'

defineProps<{ dirty: boolean; saving?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ save: []; discard: [] }>()
</script>

<template>
  <div v-if="dirty" class="flex items-center gap-2">
    <span class="flex items-center gap-1.5 text-sm font-semibold text-warn"
      ><PStatusDot tone="warn" />Unsaved changes</span
    >
    <PButton size="xs" variant="ghost" @click="emit('discard')">Discard</PButton>
    <PButton
      size="xs"
      variant="primary"
      :loading="saving"
      :disabled="disabled"
      :title="kbd('mod+s')"
      @click="emit('save')"
      >Save</PButton
    >
  </div>
  <span v-else class="flex items-center gap-1.5 text-sm text-faint"><PStatusDot tone="ok" />Saved</span>
</template>
