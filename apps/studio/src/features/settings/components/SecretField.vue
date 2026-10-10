<script setup lang="ts">
/**
 * Write-only secret input (requirements §7.3): shows whether a value is stored, never the value.
 * "Replace" opens an empty password field; saving emits the new value, which is not kept locally.
 */
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KeyRound } from 'lucide-vue-next'
import { PButton, PInput } from '@platon/ui'

const props = defineProps<{
  set: boolean
  placeholder?: string
  saving?: boolean
  id?: string
  label?: string
}>()
const emit = defineEmits<{ save: [value: string] }>()
const { t } = useI18n()

const editing = ref(false)
const draft = ref('')
const input = ref<InstanceType<typeof PInput>>()

async function start() {
  draft.value = ''
  editing.value = true
  await nextTick()
  input.value?.focus()
}
function commit() {
  if (!draft.value) return
  emit('save', draft.value)
  draft.value = ''
  editing.value = false
}
function cancel() {
  draft.value = ''
  editing.value = false
}
</script>

<template>
  <div v-if="editing" class="flex items-center gap-1.5">
    <PInput
      :id="id"
      ref="input"
      v-model="draft"
      type="password"
      mono
      autocomplete="new-password"
      class="flex-1"
      :aria-label="label"
      :placeholder="placeholder ?? t('settings.secret.placeholder')"
      @keydown.enter.prevent="commit"
      @keydown.esc.prevent="cancel"
    />
    <PButton size="sm" variant="primary" :disabled="!draft" :loading="saving" @click="commit">{{
      t('settings.secret.save')
    }}</PButton>
    <PButton size="sm" variant="ghost" @click="cancel">{{ t('settings.secret.cancel') }}</PButton>
  </div>
  <div v-else class="flex h-[34px] items-center gap-2 rounded-[9px] border border-line bg-subtle px-2.5">
    <KeyRound :size="13" class="shrink-0 text-faint" />
    <span class="min-w-0 flex-1 truncate font-mono text-sm" :class="props.set ? 'text-fg-2' : 'text-faint-2'">
      {{ props.set ? '••••••••' : t('settings.secret.notSet') }}
    </span>
    <button
      type="button"
      :id="id"
      class="text-sm font-semibold text-primary-strong hover:underline"
      @click="start"
    >
      {{ props.set ? t('settings.secret.replace') : t('settings.secret.add') }}
    </button>
  </div>
</template>
