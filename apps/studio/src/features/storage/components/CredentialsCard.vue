<script setup lang="ts">
/**
 * Access keys per environment. Secrets are write-only: the list shows a masked hint, and the only
 * action is to replace the keys. The definition keeps just a secret:// reference.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { KeyRound } from 'lucide-vue-next'
import { PBadge, PButton, PDialog, PField, PInput, toast } from '@platon/ui'
import { STORAGE_ENVS, type CredentialHints, type EnvName, type ObjectStorage } from '@platon/definition'
import { errorMessage } from '@/services/http'
import { saveCredentials, storageKeys } from '../api'
import { useStorageEdits } from '../useStorageEdits'

const props = defineProps<{ projectId: string; storage: ObjectStorage; hints?: CredentialHints }>()
const { t } = useI18n()
const qc = useQueryClient()
const edits = useStorageEdits()

const editing = ref<EnvName | null>(null)
const open = ref(false)
const accessKey = ref('')
const secretKey = ref('')
const saving = ref(false)

function start(env: EnvName) {
  editing.value = env
  accessKey.value = ''
  secretKey.value = ''
  open.value = true
}

async function save() {
  const env = editing.value
  if (!env || !accessKey.value.trim() || !secretKey.value.trim()) return
  saving.value = true
  try {
    const r = await saveCredentials(props.projectId, props.storage.id, env, {
      accessKey: accessKey.value.trim(),
      secretKey: secretKey.value.trim(),
    })
    // Rotating keys keeps the same reference; only a new reference is a definition change.
    if (props.storage.credentials?.[env] !== r.ref) edits.setCredentials(props.storage, env, r.ref)
    toast(t('storage.creds.saved', { env: t(`storage.env.${env}`) }), { tone: 'ok' })
    open.value = false
    void qc.invalidateQueries({ queryKey: storageKeys.object(props.projectId) })
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    saving.value = false
    secretKey.value = ''
  }
}
</script>

<template>
  <section>
    <h2 class="mb-2.5 text-xl font-bold">{{ t('storage.creds.title') }}</h2>
    <div class="overflow-hidden rounded-xl border border-line-2 bg-surface">
      <div
        v-for="env in STORAGE_ENVS"
        :key="env"
        class="flex flex-wrap items-center gap-3 border-b border-line-faint px-4 py-3 last:border-b-0"
      >
        <div class="min-w-[120px]">
          <div class="text-md font-semibold">{{ t(`storage.env.${env}`) }}</div>
          <div class="font-mono text-xs text-faint">
            {{ storage.credentials?.[env] ? (hints?.[env] ?? '••••••••') : t('storage.creds.notSet') }}
          </div>
        </div>
        <PBadge :tone="storage.credentials?.[env] ? 'ok' : 'warn'" size="xs">
          {{ storage.credentials?.[env] ? t('storage.object.connected') : t('storage.object.needsKeys') }}
        </PBadge>
        <PButton class="ml-auto" size="sm" :icon="KeyRound" @click="start(env)">
          {{ storage.credentials?.[env] ? t('storage.creds.replace') : t('storage.creds.add') }}
        </PButton>
      </div>
    </div>
    <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('storage.creds.note') }}</p>

    <PDialog
      v-model:open="open"
      :title="t('storage.creds.dialogTitle', { env: editing ? t(`storage.env.${editing}`) : '' })"
      :description="t('storage.creds.dialogBody', { name: storage.name })"
      :icon="KeyRound"
      :width="460"
    >
      <form id="st-creds" class="flex flex-col gap-3.5" autocomplete="off" @submit.prevent="save">
        <PField v-slot="{ id }" :label="t('storage.connect.accessKey')" required>
          <PInput :id="id" v-model="accessKey" mono autocomplete="off" spellcheck="false" />
        </PField>
        <PField v-slot="{ id }" :label="t('storage.connect.secretKey')" required>
          <PInput
            :id="id"
            v-model="secretKey"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
          />
        </PField>
      </form>
      <template #footer="{ close }">
        <PButton @click="close">{{ t('storage.common.cancel') }}</PButton>
        <PButton
          type="submit"
          form="st-creds"
          variant="primary"
          :loading="saving"
          :disabled="!accessKey.trim() || !secretKey.trim()"
          >{{ t('storage.creds.save') }}</PButton
        >
      </template>
    </PDialog>
  </section>
</template>
