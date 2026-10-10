<script setup lang="ts">
/** Replace a write-only secret. The value goes to the vault; only its secret:// reference enters the definition. */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KeyRound } from 'lucide-vue-next'
import { PButton, PDialog, PField, PInput, toast } from '@platon/ui'
import type { DbConnection } from '@platon/definition'
import { errorMessage } from '@/services/http'
import { dataApi } from '../api'
import { setCredentialChange, type Env } from '../lib/model'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ conn: DbConnection; env: Env | null }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const m = useData()
const value = ref('')
const busy = ref(false)

watch(open, (o) => {
  if (!o) value.value = ''
})

async function save() {
  if (!props.env || !value.value) return
  busy.value = true
  try {
    const res = await dataApi.putSecret(m.pid.value, props.conn.id, props.env, value.value)
    m.edit(
      setCredentialChange(props.conn, props.env, res.ref),
      t('data.conn.saved', { env: t(`data.envs.${props.env}`) }),
    )
    open.value = false
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    busy.value = false
    value.value = ''
  }
}
</script>

<template>
  <PDialog
    v-model:open="open"
    :icon="KeyRound"
    :width="460"
    :title="t('data.conn.replaceTitle', { env: env ? t(`data.envs.${env}`) : '' })"
    :description="t('data.conn.replaceDesc', { ref: `secret://${conn.id}/${env}` })"
  >
    <form id="secret-form" @submit.prevent="save">
      <PField v-slot="{ id }" :label="t('data.conn.secretLabel')">
        <PInput :id="id" v-model="value" type="password" autocomplete="new-password" mono />
      </PField>
    </form>
    <template #footer="{ close }">
      <PButton @click="close">{{ t('data.fields.cancel') }}</PButton>
      <PButton variant="primary" type="submit" form="secret-form" :loading="busy" :disabled="!value">{{
        t('data.conn.save')
      }}</PButton>
    </template>
  </PDialog>
</template>
