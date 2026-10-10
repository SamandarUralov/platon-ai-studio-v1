<script setup lang="ts">
/** Buckets of one object storage: purpose, live stats, access and versioning, plus "Add bucket". */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, Folder, FolderPlus } from 'lucide-vue-next'
import { PButton, PDialog, PField, PInput, PSelect, PSwitch, toast, type SelectOption } from '@platon/ui'
import type { BucketStats, ObjectStorage } from '@platon/definition'
import { fmtBytes } from '@/composables/format'
import { useStorageEdits } from '../useStorageEdits'
import { BUCKET_ACCESS, bucketNameError, normalizeBucketName, type BucketAccess } from '../utils'

const props = defineProps<{ storage: ObjectStorage; stats?: BucketStats[] }>()
const emit = defineEmits<{ open: [bucket: string] }>()
const { t } = useI18n()
const edits = useStorageEdits()

const accessOptions = computed<SelectOption<BucketAccess>[]>(() =>
  BUCKET_ACCESS.map((a) => ({
    value: a,
    label: t(`storage.access.${a}`),
    description: t(`storage.access.${a}Hint`),
  })),
)
const statOf = (name: string) => props.stats?.find((s) => s.name === name)

// ── add bucket ──
const adding = ref(false)
const name = ref('')
const purpose = ref('')
const access = ref<BucketAccess>('private')
const versioning = ref(false)
const touched = ref(false)
const nameError = computed(() => {
  const e = bucketNameError(
    name.value,
    props.storage.buckets.map((b) => b.name),
  )
  return touched.value && e ? t(`storage.bucket.err.${e}`) : null
})

function startAdd() {
  name.value = ''
  purpose.value = ''
  access.value = 'private'
  versioning.value = false
  touched.value = false
  adding.value = true
}

function create() {
  touched.value = true
  if (
    bucketNameError(
      name.value,
      props.storage.buckets.map((b) => b.name),
    )
  )
    return
  const ok = edits.addBucket(props.storage, {
    name: name.value,
    ...(purpose.value.trim() ? { purpose: purpose.value.trim() } : {}),
    access: access.value,
    versioning: versioning.value,
  })
  if (ok) {
    toast(t('storage.bucket.created', { name: name.value }), { tone: 'ok' })
    adding.value = false
  }
}

const onName = (v: string | number | null | undefined) => (name.value = normalizeBucketName(String(v ?? '')))
</script>

<template>
  <section>
    <div class="mb-2.5 flex items-center gap-2.5">
      <h2 class="m-0 text-xl font-bold">{{ t('storage.bucket.title') }}</h2>
      <span class="text-sm text-faint">{{
        t('storage.object.bucketCount', { n: storage.buckets.length }, storage.buckets.length)
      }}</span>
      <PButton class="ml-auto" size="sm" :icon="FolderPlus" @click="startAdd">{{
        t('storage.bucket.add')
      }}</PButton>
    </div>

    <div class="overflow-x-auto rounded-xl border border-line-2 bg-surface">
      <table class="w-full min-w-[760px] border-collapse text-base">
        <thead>
          <tr class="border-b border-line-faint bg-subtle text-left text-xs font-semibold text-muted">
            <th class="px-4 py-2.5 font-semibold">{{ t('storage.bucket.name') }}</th>
            <th class="px-4 py-2.5 font-semibold">{{ t('storage.bucket.purpose') }}</th>
            <th class="px-4 py-2.5 text-right font-semibold">{{ t('storage.bucket.objects') }}</th>
            <th class="px-4 py-2.5 text-right font-semibold">{{ t('storage.bucket.size') }}</th>
            <th class="px-4 py-2.5 font-semibold">{{ t('storage.bucket.access') }}</th>
            <th class="px-4 py-2.5 font-semibold">{{ t('storage.bucket.versioning') }}</th>
            <th class="w-10" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in storage.buckets"
            :key="b.name"
            class="cursor-pointer border-b border-line-faint last:border-b-0 hover:bg-hover"
            tabindex="0"
            @click="emit('open', b.name)"
            @keydown.enter.self="emit('open', b.name)"
          >
            <td class="px-4 py-2">
              <span class="flex items-center gap-2 font-mono text-sm"
                ><Folder :size="14" class="text-faint" aria-hidden="true" />{{ b.name }}</span
              >
            </td>
            <td class="px-4 py-2 text-fg-2">{{ b.purpose || '—' }}</td>
            <td class="px-4 py-2 text-right tabular-nums text-fg-2">
              {{ statOf(b.name)?.objects.toLocaleString() ?? '…' }}
            </td>
            <td class="px-4 py-2 text-right tabular-nums text-fg-2">
              {{ statOf(b.name) ? fmtBytes(statOf(b.name)!.bytes) : '…' }}
            </td>
            <td class="px-4 py-1.5" @click.stop @keydown.stop>
              <PSelect
                :model-value="b.access"
                :options="accessOptions"
                size="sm"
                class="w-[140px]"
                :aria-label="t('storage.bucket.access')"
                @update:model-value="
                  (v) => v && v !== b.access && edits.setBucket(storage, b.name, 'access', v)
                "
              />
            </td>
            <td class="px-4 py-1.5" @click.stop @keydown.stop>
              <span class="flex items-center gap-2 text-sm text-muted">
                <PSwitch
                  :model-value="b.versioning"
                  size="sm"
                  :label="t('storage.bucket.versioning')"
                  @update:model-value="(v) => edits.setBucket(storage, b.name, 'versioning', v)"
                />
                {{ b.versioning ? t('storage.common.on') : t('storage.common.off') }}
              </span>
            </td>
            <td class="pr-3 text-faint"><ChevronRight :size="15" /></td>
          </tr>
          <tr v-if="!storage.buckets.length">
            <td colspan="7" class="px-4 py-6 text-center text-base text-faint">
              {{ t('storage.bucket.none') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PDialog
      v-model:open="adding"
      :title="t('storage.bucket.add')"
      :description="t('storage.bucket.addHint')"
      :icon="FolderPlus"
      :width="480"
    >
      <form id="st-add-bucket" class="flex flex-col gap-3.5" @submit.prevent="create">
        <PField
          v-slot="{ id }"
          :label="t('storage.bucket.name')"
          :error="nameError"
          :hint="t('storage.bucket.nameHint')"
          required
        >
          <PInput
            :id="id"
            :model-value="name"
            mono
            placeholder="fieldops-invoices"
            :invalid="!!nameError"
            autofocus
            @update:model-value="onName"
            @blur="touched = true"
          />
        </PField>
        <PField v-slot="{ id }" :label="t('storage.bucket.purpose')">
          <PInput :id="id" v-model="purpose" :placeholder="t('storage.bucket.purposePlaceholder')" />
        </PField>
        <PField :label="t('storage.bucket.access')">
          <PSelect v-model="access" :options="accessOptions" :aria-label="t('storage.bucket.access')" />
        </PField>
        <PField :label="t('storage.bucket.versioning')" :hint="t('storage.bucket.versioningHint')" inline>
          <PSwitch v-model="versioning" :label="t('storage.bucket.versioning')" />
        </PField>
      </form>
      <template #footer="{ close }">
        <PButton @click="close">{{ t('storage.common.cancel') }}</PButton>
        <PButton type="submit" form="st-add-bucket" variant="primary">{{
          t('storage.bucket.create')
        }}</PButton>
      </template>
    </PDialog>
  </section>
</template>
