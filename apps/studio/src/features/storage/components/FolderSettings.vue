<script setup lang="ts">
/** Size limit, function access, cleanup rule and nightly backup of one local folder (definition edits). */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PSelect, PSwitch, type SelectOption } from '@platon/ui'
import type { LocalFolder, ObjectStorage } from '@platon/definition'
import { useLabels } from '../useLabels'
import { useStorageEdits } from '../useStorageEdits'
import { CLEANUP_OPTIONS, FOLDER_ACCESS, QUOTA_OPTIONS, type FolderAccess } from '../utils'

const props = defineProps<{ folder: LocalFolder; storages: ObjectStorage[] }>()
const { t } = useI18n()
const labels = useLabels()
const edits = useStorageEdits()

// Keep a value that isn't in the preset list (e.g. set by AI or JSON) selectable.
const withCurrent = (list: readonly string[], cur: string) =>
  list.includes(cur) ? [...list] : [...list, cur]

const quotaOptions = computed(() =>
  withCurrent(QUOTA_OPTIONS, props.folder.quota).map((q) => ({ value: q, label: q })),
)
const accessOptions = computed<SelectOption<FolderAccess>[]>(() =>
  FOLDER_ACCESS.map((a) => ({
    value: a,
    label: t(`storage.folderAccess.${a}`),
    description: t(`storage.folderAccess.${a}Hint`),
  })),
)
const NEVER = 'never'
const cleanupValue = computed(() => props.folder.cleanup || NEVER)
const cleanupOptions = computed(() =>
  withCurrent(
    CLEANUP_OPTIONS.map((c) => c || NEVER),
    cleanupValue.value,
  ).map((c) => ({ value: c, label: labels.cleanup(c === NEVER ? '' : c) })),
)
const targetOptions = computed(() => props.storages.map((s) => ({ value: s.id, label: s.name })))

const name = computed(() => `${props.folder.path}/`)

function setQuota(v: string | undefined) {
  if (v && v !== props.folder.quota)
    edits.setFolder(props.folder, 'quota', v, `Set ${name.value} size limit to ${v}`)
}
function setAccess(v: FolderAccess | undefined) {
  if (v && v !== props.folder.access)
    edits.setFolder(
      props.folder,
      'access',
      v,
      `Set function access on ${name.value} to ${t(`storage.folderAccess.${v}`).toLowerCase()}`,
    )
}
function setCleanup(v: string | undefined) {
  if (!v || v === cleanupValue.value) return
  const rule = v === NEVER ? '' : v
  edits.setFolder(
    props.folder,
    'cleanup',
    rule,
    `Set cleanup on ${name.value} to “${labels.cleanup(rule).toLowerCase()}”`,
  )
}
function setBackup(enabled: boolean, target = props.folder.backup?.target ?? props.storages[0]?.id) {
  const value = { enabled, ...(target ? { target } : {}) }
  const text = enabled
    ? `Turned on nightly backup of ${name.value}${target ? ` to ${target}` : ''}`
    : `Turned off nightly backup of ${name.value}`
  edits.setFolder(props.folder, 'backup', value, text)
}
</script>

<template>
  <div class="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2.5">
    <div class="rounded-xl border border-line-2 bg-surface px-3.5 py-3">
      <div class="mb-2 text-sm font-semibold text-muted">{{ t('storage.folder.quota') }}</div>
      <PSelect
        :model-value="folder.quota"
        :options="quotaOptions"
        size="sm"
        :aria-label="t('storage.folder.quota')"
        @update:model-value="setQuota"
      />
    </div>
    <div class="rounded-xl border border-line-2 bg-surface px-3.5 py-3">
      <div class="mb-2 text-sm font-semibold text-muted">{{ t('storage.folder.access') }}</div>
      <PSelect
        :model-value="folder.access"
        :options="accessOptions"
        size="sm"
        :aria-label="t('storage.folder.access')"
        @update:model-value="setAccess"
      />
    </div>
    <div class="rounded-xl border border-line-2 bg-surface px-3.5 py-3">
      <div class="mb-2 text-sm font-semibold text-muted">{{ t('storage.folder.cleanup') }}</div>
      <PSelect
        :model-value="cleanupValue"
        :options="cleanupOptions"
        size="sm"
        :aria-label="t('storage.folder.cleanup')"
        @update:model-value="setCleanup"
      />
    </div>
    <div class="rounded-xl border border-line-2 bg-surface px-3.5 py-3">
      <div class="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
        {{ t('storage.folder.backup') }}
        <PSwitch
          class="ml-auto"
          size="sm"
          :model-value="!!folder.backup?.enabled"
          :disabled="!storages.length"
          :label="t('storage.folder.backup')"
          @update:model-value="(v) => setBackup(v)"
        />
      </div>
      <PSelect
        v-if="folder.backup?.enabled"
        :model-value="folder.backup?.target"
        :options="targetOptions"
        size="sm"
        :placeholder="t('storage.folder.backupTarget')"
        :aria-label="t('storage.folder.backupTarget')"
        @update:model-value="(v) => v && setBackup(true, v)"
      />
      <p v-else class="m-0 flex h-[30px] items-center text-sm text-faint">
        {{ storages.length ? t('storage.folder.backupOff') : t('storage.folder.backupNoTarget') }}
      </p>
    </div>
  </div>
</template>
