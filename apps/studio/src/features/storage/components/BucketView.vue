<script setup lang="ts">
/** One bucket: access, versioning, removal and its file browser. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowLeft, FolderOpen, Trash2, TriangleAlert } from 'lucide-vue-next'
import { PButton, PSelect, PSwitch, PTooltip, toast, type SelectOption } from '@platon/ui'
import type { Bucket, BucketStats, ObjectStorage } from '@platon/definition'
import { fmtBytes } from '@/composables/format'
import { projectLinks } from '@/composables/useProject'
import { objectBase } from '../api'
import { useStorageEdits } from '../useStorageEdits'
import { BUCKET_ACCESS, type BucketAccess } from '../utils'
import ConfirmDialog from './ConfirmDialog.vue'
import FileBrowser from './FileBrowser.vue'

const props = defineProps<{
  projectId: string
  storage: ObjectStorage
  bucket: Bucket
  stats?: BucketStats
}>()
const { t } = useI18n()
const router = useRouter()
const edits = useStorageEdits()
const links = computed(() => projectLinks(props.projectId))

const accessOptions = computed<SelectOption<BucketAccess>[]>(() =>
  BUCKET_ACCESS.map((a) => ({
    value: a,
    label: t(`storage.access.${a}`),
    description: t(`storage.access.${a}Hint`),
  })),
)
const base = computed(() => objectBase(props.projectId, props.storage.id, props.bucket.name))

const confirmOpen = ref(false)
function remove() {
  const name = props.bucket.name
  if (edits.removeBucket(props.storage, name)) {
    confirmOpen.value = false
    toast(t('storage.bucket.removed', { name }))
    void router.push(links.value.storage('object', props.storage.id))
  }
}
</script>

<template>
  <div>
    <button
      type="button"
      class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
      @click="router.push(links.storage('object', storage.id))"
    >
      <ArrowLeft :size="13" />{{ storage.name }}
    </button>
    <div class="flex flex-wrap items-center gap-3">
      <div class="grid size-10 place-items-center rounded-[10px] bg-primary-tint text-primary-strong">
        <FolderOpen :size="19" />
      </div>
      <div class="min-w-0">
        <h1 class="m-0 truncate font-mono text-[20px] font-bold">{{ bucket.name }}</h1>
        <div class="mt-0.5 text-sm text-faint">
          {{ bucket.purpose || t('storage.bucket.noPurpose') }} ·
          <span class="font-mono">s3://{{ storage.id }}/{{ bucket.name }}/</span>
        </div>
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <PSelect
          :model-value="bucket.access"
          :options="accessOptions"
          size="sm"
          class="w-[150px]"
          :aria-label="t('storage.bucket.access')"
          @update:model-value="
            (v) => v && v !== bucket.access && edits.setBucket(storage, bucket.name, 'access', v)
          "
        />
        <label
          class="flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold"
        >
          <PSwitch
            :model-value="bucket.versioning"
            size="sm"
            :label="t('storage.bucket.versioning')"
            @update:model-value="(v) => edits.setBucket(storage, bucket.name, 'versioning', v)"
          />
          {{ bucket.versioning ? t('storage.bucket.versioningOn') : t('storage.bucket.versioningOff') }}
        </label>
        <PTooltip :text="t('storage.bucket.remove')">
          <PButton
            square
            variant="danger"
            :icon="Trash2"
            :label="t('storage.bucket.remove')"
            @click="confirmOpen = true"
          />
        </PTooltip>
      </div>
    </div>

    <div class="mb-5 mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
      <span
        ><b class="text-fg">{{ stats ? stats.objects.toLocaleString() : '…' }}</b>
        {{ t('storage.object.objects', stats?.objects ?? 0) }}</span
      >
      <span
        ><b class="text-fg">{{ stats ? fmtBytes(stats.bytes) : '…' }}</b>
        {{ t('storage.bucket.storedDev') }}</span
      >
    </div>

    <FileBrowser :base="base" :root-label="`${bucket.name}/`" can-sign>
      <template #notice>
        <div
          v-if="bucket.access === 'public'"
          class="flex gap-2 border-b border-line-faint bg-warn-bg px-3.5 py-2 text-sm text-warn"
        >
          <TriangleAlert :size="14" class="mt-0.5 shrink-0" />{{ t('storage.bucket.publicWarn') }}
        </div>
      </template>
    </FileBrowser>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="t('storage.bucket.removeTitle', { name: bucket.name })"
      :description="t('storage.bucket.removeBody')"
      :confirm-label="t('storage.bucket.remove')"
      @confirm="remove"
    />
  </div>
</template>
