<script setup lang="ts">
/** Declare a new folder under the local root. Starts read-only for functions, like the mockup. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { FolderPlus } from 'lucide-vue-next'
import { PButton, PDialog, PField, PSelect, toast, type SelectOption } from '@platon/ui'
import type { LocalStorage } from '@platon/definition'
import { projectLinks } from '@/composables/useProject'
import { useLabels } from '../useLabels'
import { useStorageEdits } from '../useStorageEdits'
import {
  CLEANUP_OPTIONS,
  FOLDER_ACCESS,
  folderPathError,
  newStorageId,
  normalizeFolderPath,
  QUOTA_OPTIONS,
  type FolderAccess,
} from '../utils'

const props = defineProps<{ projectId: string; local: LocalStorage }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const labels = useLabels()
const router = useRouter()
const edits = useStorageEdits()

const path = ref('')
const quota = ref<string>('1 GB')
const access = ref<FolderAccess>('read')
const cleanup = ref<string>('never')
const touched = ref(false)
watch(open, (v) => {
  if (!v) return
  path.value = ''
  quota.value = '1 GB'
  access.value = 'read'
  cleanup.value = 'never'
  touched.value = false
})

const taken = computed(() => props.local.folders.map((f) => f.path))
const error = computed(() => {
  const e = folderPathError(path.value.replace(/\/+$/, ''), taken.value)
  return touched.value && e ? t(`storage.folder.err.${e}`) : null
})
const quotaOptions = QUOTA_OPTIONS.map((q) => ({ value: q, label: q }))
const accessOptions = computed<SelectOption<FolderAccess>[]>(() =>
  FOLDER_ACCESS.map((a) => ({ value: a, label: t(`storage.folderAccess.${a}`) })),
)
const cleanupOptions = computed(() =>
  CLEANUP_OPTIONS.map((c) => ({ value: c || 'never', label: labels.cleanup(c) })),
)

function create() {
  touched.value = true
  const p = path.value.replace(/\/+$/, '')
  if (folderPathError(p, taken.value)) return
  const id = newStorageId(
    p,
    props.local.folders.map((f) => f.id),
    'folder',
  )
  const ok = edits.addFolder({
    id,
    path: p,
    quota: quota.value,
    access: access.value,
    cleanup: cleanup.value === 'never' ? '' : cleanup.value,
    backup: { enabled: false },
  })
  if (ok) {
    open.value = false
    toast(t('storage.folder.added', { path: p }), { tone: 'ok' })
    void router.push(projectLinks(props.projectId).storage('local', id))
  }
}
</script>

<template>
  <PDialog
    v-model:open="open"
    :title="t('storage.local.addFolder')"
    :description="t('storage.folder.addHint')"
    :icon="FolderPlus"
    :width="500"
  >
    <form id="st-add-folder" class="flex flex-col gap-3.5" @submit.prevent="create">
      <PField v-slot="{ id }" :label="t('storage.folder.path')" :error="error" required>
        <div
          class="flex h-[34px] items-center overflow-hidden rounded-[9px] border border-line bg-surface focus-within:border-primary focus-within:shadow-focus"
        >
          <span class="whitespace-nowrap pl-2.5 font-mono text-sm text-faint">{{ local.root }}/</span>
          <input
            :id="id"
            :value="path"
            class="h-full min-w-0 flex-1 bg-transparent pr-2.5 font-mono text-sm text-fg outline-none placeholder:text-faint-2"
            placeholder="imports"
            autofocus
            @input="path = normalizeFolderPath(($event.target as HTMLInputElement).value)"
            @blur="touched = true"
          />
        </div>
      </PField>
      <div class="grid grid-cols-3 gap-2.5">
        <PField :label="t('storage.folder.quota')"
          ><PSelect v-model="quota" :options="quotaOptions" :aria-label="t('storage.folder.quota')"
        /></PField>
        <PField :label="t('storage.folder.access')"
          ><PSelect v-model="access" :options="accessOptions" :aria-label="t('storage.folder.access')"
        /></PField>
        <PField :label="t('storage.folder.cleanup')"
          ><PSelect v-model="cleanup" :options="cleanupOptions" :aria-label="t('storage.folder.cleanup')"
        /></PField>
      </div>
    </form>
    <template #footer="{ close }">
      <PButton @click="close">{{ t('storage.common.cancel') }}</PButton>
      <PButton type="submit" form="st-add-folder" variant="primary">{{
        t('storage.local.addFolder')
      }}</PButton>
    </template>
  </PDialog>
</template>
