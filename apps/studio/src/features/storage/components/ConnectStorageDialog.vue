<script setup lang="ts">
/** Connect a MinIO / S3-compatible service. Keys entered here are saved for Development only. */
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { CircleAlert, CircleCheck, CircleDashed, HardDrive, Info, PlugZap } from 'lucide-vue-next'
import {
  PButton,
  PCheckbox,
  PDialog,
  PField,
  PIcon,
  PInput,
  PSegmented,
  PSpinner,
  toast,
  toneClasses,
} from '@platon/ui'
import type { ObjectStorage, StorageTestResponse } from '@platon/definition'
import { projectLinks } from '@/composables/useProject'
import { errorMessage } from '@/services/http'
import { saveCredentials, storageKeys, testNewStorage } from '../api'
import { useStorageEdits } from '../useStorageEdits'
import {
  bucketNameError,
  isValidEndpoint,
  newStorageId,
  normalizeBucketName,
  PURPOSES,
  type Purpose,
} from '../utils'

const props = defineProps<{ projectId: string; taken: string[] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const router = useRouter()
const qc = useQueryClient()
const edits = useStorageEdits()

type Provider = ObjectStorage['provider']
const blank = () => ({
  provider: 'minio' as Provider,
  name: '',
  purpose: 'files' as Purpose,
  endpoint: '',
  region: 'us-east-1',
  accessKey: '',
  secretKey: '',
  bucket: '',
  tls: true,
})
const f = reactive(blank())
const touched = ref(false)
const test = ref<'idle' | 'testing' | StorageTestResponse>('idle')
const creating = ref(false)

watch(open, (v) => {
  if (!v) return
  Object.assign(f, blank())
  touched.value = false
  test.value = 'idle'
})
// Any connection detail change invalidates the last test.
watch(
  () => [f.endpoint, f.region, f.accessKey, f.secretKey, f.tls, f.provider],
  () => {
    if (test.value !== 'testing') test.value = 'idle'
  },
)
watch(
  () => f.provider,
  (p) => {
    if (p === 's3' && !f.endpoint) f.endpoint = `https://s3.${f.region || 'us-east-1'}.amazonaws.com`
  },
)

const providerOptions = computed(() => [
  { value: 'minio' as Provider, label: t('storage.provider.minio') },
  { value: 's3' as Provider, label: t('storage.provider.s3') },
])
const endpointPh = 'https://minio.company.internal:9000'
const purposes = Object.entries(PURPOSES) as [Purpose, (typeof PURPOSES)[Purpose]][]

const errors = computed(() => ({
  name: !f.name.trim() ? t('storage.connect.err.name') : null,
  endpoint: !isValidEndpoint(f.endpoint) ? t('storage.connect.err.endpoint') : null,
  bucket: f.bucket && bucketNameError(f.bucket) ? t(`storage.bucket.err.${bucketNameError(f.bucket)}`) : null,
  keys: !!f.accessKey.trim() !== !!f.secretKey.trim() ? t('storage.connect.err.keys') : null,
}))
const valid = computed(() => Object.values(errors.value).every((e) => !e))
const shown = (k: keyof typeof errors.value) => (touched.value ? errors.value[k] : null)

async function runTest() {
  test.value = 'testing'
  try {
    test.value = await testNewStorage(props.projectId, {
      provider: f.provider,
      endpoint: f.endpoint.trim(),
      region: f.region.trim(),
      tls: f.tls,
      accessKey: f.accessKey.trim(),
      secretKey: f.secretKey,
      ...(f.bucket ? { bucket: f.bucket } : {}),
    })
  } catch (e) {
    test.value = { ok: false, message: errorMessage(e) }
  }
}

const testView = computed(() => {
  const v = test.value
  if (v === 'idle') return { icon: CircleDashed, cls: 'text-faint', text: t('storage.connect.notTested') }
  if (v === 'testing') return { icon: null, cls: 'text-primary', text: t('storage.connect.testing') }
  return { icon: v.ok ? CircleCheck : CircleAlert, cls: v.ok ? 'text-ok' : 'text-danger', text: v.message }
})

async function create() {
  touched.value = true
  if (!valid.value) return
  creating.value = true
  try {
    const id = newStorageId(f.name, props.taken)
    let credentials: ObjectStorage['credentials']
    if (f.accessKey.trim()) {
      const r = await saveCredentials(props.projectId, id, 'development', {
        accessKey: f.accessKey.trim(),
        secretKey: f.secretKey,
      })
      credentials = { development: r.ref }
    }
    const st: ObjectStorage = {
      id,
      name: f.name.trim(),
      provider: f.provider,
      purpose: f.purpose,
      endpoint: f.endpoint.trim().replace(/\/+$/, ''),
      ...(f.region.trim() ? { region: f.region.trim() } : {}),
      tls: f.tls,
      ...(credentials ? { credentials } : {}),
      buckets: f.bucket
        ? [
            {
              name: f.bucket,
              purpose: t(`storage.purpose.${f.purpose}.label`),
              access: 'private',
              versioning: false,
            },
          ]
        : [],
    }
    if (edits.addStorage(st)) {
      toast(t('storage.connect.created', { name: st.name }), { tone: 'ok' })
      open.value = false
      void qc.invalidateQueries({ queryKey: storageKeys.object(props.projectId) })
      void router.push(projectLinks(props.projectId).storage('object', id))
    }
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    creating.value = false
    f.secretKey = ''
  }
}
</script>

<template>
  <PDialog
    v-model:open="open"
    :title="t('storage.connect.title')"
    :description="t('storage.connect.sub')"
    :icon="HardDrive"
    :width="640"
  >
    <form id="st-connect" class="flex flex-col gap-4" autocomplete="off" @submit.prevent="create">
      <PField :label="t('storage.connect.provider')">
        <PSegmented
          v-model="f.provider"
          :options="providerOptions"
          :aria-label="t('storage.connect.provider')"
        />
      </PField>
      <PField v-slot="{ id }" :label="t('storage.connect.name')" :error="shown('name')" required>
        <PInput
          :id="id"
          v-model="f.name"
          :placeholder="t('storage.connect.namePlaceholder')"
          :invalid="!!shown('name')"
          autofocus
        />
      </PField>

      <div>
        <div class="mb-1.5 text-sm font-semibold text-fg-2">{{ t('storage.connect.purpose') }}</div>
        <div class="grid grid-cols-2 gap-2" role="radiogroup" :aria-label="t('storage.connect.purpose')">
          <button
            v-for="[key, p] in purposes"
            :key="key"
            type="button"
            role="radio"
            :aria-checked="f.purpose === key"
            class="flex items-start gap-2.5 rounded-xl border-[1.5px] p-3 text-left transition-colors"
            :class="f.purpose === key ? 'border-primary bg-primary-tint/40' : 'border-line hover:bg-hover'"
            @click="f.purpose = key"
          >
            <span
              class="grid size-[30px] shrink-0 place-items-center rounded-lg"
              :class="[toneClasses[p.tone].bg, toneClasses[p.tone].fg]"
              ><PIcon :name="p.icon" :size="15"
            /></span>
            <span class="min-w-0">
              <span class="block text-base font-bold">{{ t(`storage.purpose.${key}.label`) }}</span>
              <span class="mt-0.5 block text-xs leading-snug text-muted">{{
                t(`storage.purpose.${key}.desc`)
              }}</span>
            </span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2.5">
        <PField
          v-slot="{ id: endpointId }"
          :label="t('storage.connect.endpoint')"
          :error="shown('endpoint')"
          required
        >
          <PInput
            :id="endpointId"
            v-model="f.endpoint"
            mono
            :placeholder="endpointPh"
            :invalid="!!shown('endpoint')"
          />
        </PField>
        <PField v-slot="{ id }" :label="t('storage.connect.region')">
          <PInput :id="id" v-model="f.region" mono />
        </PField>
        <PField v-slot="{ id }" :label="t('storage.connect.accessKey')" :error="shown('keys')">
          <PInput
            :id="id"
            v-model="f.accessKey"
            mono
            :placeholder="t('storage.connect.accessKeyPlaceholder')"
            spellcheck="false"
          />
        </PField>
        <PField v-slot="{ id }" :label="t('storage.connect.secretKey')">
          <PInput
            :id="id"
            v-model="f.secretKey"
            type="password"
            placeholder="••••••••"
            autocomplete="new-password"
          />
        </PField>
      </div>
      <div class="grid grid-cols-2 items-end gap-2.5">
        <PField v-slot="{ id }" :label="t('storage.connect.bucket')" :error="shown('bucket')">
          <PInput
            :id="id"
            :model-value="f.bucket"
            mono
            placeholder="fieldops-invoices"
            @update:model-value="(v) => (f.bucket = normalizeBucketName(String(v ?? '')))"
          />
        </PField>
        <label class="flex h-[34px] cursor-pointer items-center gap-2 text-base text-fg-2">
          <PCheckbox :model-value="f.tls" @update:model-value="(v) => (f.tls = v === true)" />{{
            t('storage.connect.tls')
          }}
        </label>
      </div>

      <div class="flex flex-wrap items-center gap-3 rounded-[10px] bg-subtle px-3 py-2.5">
        <PButton
          size="sm"
          :icon="PlugZap"
          :disabled="test === 'testing' || !isValidEndpoint(f.endpoint)"
          @click="runTest"
          >{{ t('storage.object.test') }}</PButton
        >
        <span class="flex items-center gap-1.5 text-sm font-semibold" :class="testView.cls" role="status">
          <PSpinner v-if="!testView.icon" :size="13" />
          <component :is="testView.icon" v-else :size="14" />
          {{ testView.text }}
        </span>
      </div>
      <p class="m-0 flex gap-2 text-sm leading-relaxed text-muted">
        <Info :size="13" class="mt-0.5 shrink-0" />
        <span>{{ t('storage.connect.devOnly') }}</span>
      </p>
    </form>
    <template #footer="{ close }">
      <PButton @click="close">{{ t('storage.common.cancel') }}</PButton>
      <PButton
        type="submit"
        form="st-connect"
        variant="primary"
        :loading="creating"
        :disabled="touched && !valid"
        >{{ t('storage.connect.create') }}</PButton
      >
    </template>
  </PDialog>
</template>
