<script setup lang="ts">
/**
 * File browser shared by buckets and local folders: prefix breadcrumb, search, upload (picker or
 * drag & drop), download, signed link (object storage only) and delete with confirmation.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import {
  ChevronRight,
  Download,
  Folder,
  Link2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-vue-next'
import { PBadge, PButton, PIcon, PInput, PSpinner, PTooltip, toast } from '@platon/ui'
import type { StorageFile } from '@platon/definition'
import { fmtBytes, relTime } from '@/composables/format'
import { errorMessage } from '@/services/http'
import { deleteFile, downloadFile, signedLink, uploadFiles, useFiles } from '../api'
import { baseName, breadcrumbs, fileIcon } from '../utils'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps<{
  /** API base of the container, e.g. /projects/p/storage/object/s/buckets/b */
  base: string
  /** Shown as the breadcrumb root, e.g. s3://field_files/fieldops-photos/ */
  rootLabel: string
  canSign?: boolean
  /** Uploads disabled (e.g. a read-only view); downloads still work. */
  readonly?: boolean
}>()

const { t } = useI18n()
const qc = useQueryClient()

const prefix = ref('')
const search = ref('')
const q = refDebounced(search, 250)
watch(
  () => props.base,
  () => {
    prefix.value = ''
    search.value = ''
  },
)

const { data, isLoading, isFetching, error, refetch } = useFiles(
  () => props.base,
  prefix,
  () => q.value.trim(),
)
const searching = computed(() => !!q.value.trim())
const crumbs = computed(() => breadcrumbs(prefix.value))
const folders = computed(() => data.value?.folders ?? [])
const items = computed(() => data.value?.items ?? [])
const empty = computed(() => !isLoading.value && !folders.value.length && !items.value.length)

function refreshAll() {
  void qc.invalidateQueries({ queryKey: ['storage'] })
}

// ── upload ──────────────────────────────────────────────
const picker = ref<HTMLInputElement>()
const uploading = ref(0)
async function upload(list: FileList | File[] | null | undefined) {
  const files = Array.from(list ?? [])
  if (!files.length || props.readonly) return
  uploading.value = files.length
  try {
    await uploadFiles(props.base, files, prefix.value)
    toast(
      files.length === 1
        ? t('storage.files.uploadedOne', { name: files[0]!.name })
        : t('storage.files.uploadedMany', { n: files.length }),
      { tone: 'ok' },
    )
    refreshAll()
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    uploading.value = 0
    if (picker.value) picker.value.value = ''
  }
}

const dragDepth = ref(0)
const dragging = computed(() => dragDepth.value > 0 && !props.readonly)
const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
function onDragEnter(e: DragEvent) {
  if (hasFiles(e)) dragDepth.value++
}
function onDragLeave(e: DragEvent) {
  if (hasFiles(e)) dragDepth.value = Math.max(0, dragDepth.value - 1)
}
function onDrop(e: DragEvent) {
  dragDepth.value = 0
  void upload(e.dataTransfer?.files)
}

// ── row actions ─────────────────────────────────────────
const busyKey = ref<string | null>(null)
async function download(f: StorageFile) {
  busyKey.value = f.key
  try {
    await downloadFile(props.base, f.key)
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    busyKey.value = null
  }
}

async function copyLink(f: StorageFile) {
  try {
    const r = await signedLink(props.base, f.key)
    try {
      await navigator.clipboard.writeText(r.url)
      toast(t('storage.files.linkCopied'), { tone: 'ok' })
    } catch {
      // Clipboard blocked (permissions/insecure context): still give the link to the user.
      toast(r.url, { duration: 8000 })
    }
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  }
}

const toDelete = ref<StorageFile | null>(null)
const deleteOpen = computed({
  get: () => !!toDelete.value,
  set: (v) => {
    if (!v) toDelete.value = null
  },
})
const deleting = ref(false)
async function confirmDelete() {
  const f = toDelete.value
  if (!f) return
  deleting.value = true
  try {
    await deleteFile(props.base, f.key)
    toast(t('storage.files.deleted', { name: baseName(f.key) }))
    toDelete.value = null
    refreshAll()
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    deleting.value = false
  }
}

const rowName = (f: StorageFile) => (searching.value ? f.key : f.key.slice(prefix.value.length))
</script>

<template>
  <section
    class="relative overflow-hidden rounded-xl border border-line-2 bg-surface"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- toolbar -->
    <div class="flex flex-wrap items-center gap-2 border-b border-line-faint bg-subtle px-3.5 py-2.5">
      <nav
        class="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 font-mono text-sm"
        :aria-label="t('storage.files.path')"
      >
        <button
          type="button"
          class="rounded-md px-1 py-0.5 font-semibold hover:bg-hover"
          :class="prefix ? 'text-muted' : 'text-fg'"
          @click="prefix = ''"
        >
          {{ rootLabel }}
        </button>
        <template v-for="c in crumbs" :key="c.prefix">
          <ChevronRight :size="12" class="text-faint" aria-hidden="true" />
          <button
            type="button"
            class="rounded-md px-1 py-0.5 hover:bg-hover"
            :class="c.prefix === prefix ? 'font-semibold text-fg' : 'text-muted'"
            @click="prefix = c.prefix"
          >
            {{ c.label }}
          </button>
        </template>
      </nav>
      <PInput
        v-model="search"
        :icon="Search"
        size="sm"
        class="w-52"
        :placeholder="t('storage.files.search')"
        :aria-label="t('storage.files.search')"
      />
      <PButton
        square
        size="sm"
        variant="ghost"
        :icon="RefreshCw"
        :label="t('storage.files.refresh')"
        :title="t('storage.files.refresh')"
        :disabled="isFetching"
        @click="refetch()"
      />
      <template v-if="!readonly">
        <input
          ref="picker"
          type="file"
          multiple
          class="hidden"
          @change="upload(($event.target as HTMLInputElement).files)"
        />
        <PButton
          size="sm"
          variant="primary"
          :icon="Upload"
          :loading="uploading > 0"
          @click="picker?.click()"
          >{{ t('storage.files.upload') }}</PButton
        >
      </template>
    </div>

    <slot name="notice" />

    <!-- list -->
    <div class="overflow-x-auto">
      <div class="min-w-[520px]">
        <div
          class="grid grid-cols-[minmax(220px,1fr)_96px_120px_112px] border-b border-line-faint text-xs font-semibold text-muted"
        >
          <div class="px-3.5 py-2">{{ t('storage.files.name') }}</div>
          <div class="px-3.5 py-2">{{ t('storage.files.size') }}</div>
          <div class="px-3.5 py-2">{{ t('storage.files.modified') }}</div>
          <div class="px-3.5 py-2" />
        </div>

        <div v-if="isLoading" class="grid place-items-center py-10 text-muted"><PSpinner /></div>
        <div v-else-if="error" class="px-4 py-8 text-center text-base text-danger">
          {{ errorMessage(error) }}
        </div>
        <template v-else>
          <button
            v-for="f in folders"
            :key="f"
            type="button"
            class="grid w-full grid-cols-[minmax(220px,1fr)_96px_120px_112px] items-center border-b border-line-faint text-left text-sm hover:bg-hover"
            @click="prefix = f"
          >
            <span class="flex min-w-0 items-center gap-2 px-3.5 py-2">
              <Folder :size="14" class="shrink-0 text-warn" aria-hidden="true" />
              <span class="truncate font-mono text-xs">{{ f.slice(prefix.length) }}</span>
            </span>
            <span class="px-3.5 text-faint">—</span>
            <span class="px-3.5 text-faint">—</span>
            <span />
          </button>
          <div
            v-for="f in items"
            :key="f.key"
            class="group grid grid-cols-[minmax(220px,1fr)_96px_120px_112px] items-center border-b border-line-faint text-sm last:border-b-0 hover:bg-hover"
          >
            <div class="flex min-w-0 items-center gap-2 px-3.5 py-2">
              <PIcon :name="fileIcon(f.key, f.contentType)" :size="14" class="shrink-0 text-faint" />
              <span class="truncate font-mono text-xs" :title="f.key">{{ rowName(f) }}</span>
            </div>
            <div class="px-3.5 text-muted">{{ fmtBytes(f.size) }}</div>
            <div class="px-3.5 text-muted" :title="f.modifiedAt">{{ relTime(f.modifiedAt) }}</div>
            <div class="flex justify-end gap-1 px-2.5 py-1">
              <PTooltip :text="t('storage.files.download')">
                <PButton
                  square
                  size="xs"
                  variant="ghost"
                  :icon="Download"
                  :label="t('storage.files.download')"
                  :loading="busyKey === f.key"
                  @click="download(f)"
                />
              </PTooltip>
              <PTooltip v-if="canSign" :text="t('storage.files.copyLink')">
                <PButton
                  square
                  size="xs"
                  variant="ghost"
                  :icon="Link2"
                  :label="t('storage.files.copyLink')"
                  @click="copyLink(f)"
                />
              </PTooltip>
              <PTooltip v-if="!readonly" :text="t('storage.files.delete')">
                <PButton
                  square
                  size="xs"
                  variant="ghost"
                  :icon="Trash2"
                  :label="t('storage.files.delete')"
                  class="hover:text-danger"
                  @click="toDelete = f"
                />
              </PTooltip>
            </div>
          </div>
          <div v-if="empty" class="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <UploadCloud :size="22" class="text-faint" aria-hidden="true" />
            <div class="text-base font-semibold text-fg-2">
              {{ searching ? t('storage.files.noMatches') : t('storage.files.empty') }}
            </div>
            <div v-if="!searching && !readonly" class="text-sm text-faint">
              {{ t('storage.files.dropHint') }}
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="flex items-center gap-2 border-t border-line-faint px-3.5 py-2 text-xs text-faint">
      <PBadge size="xs" tone="primary">{{ t('storage.env.development') }}</PBadge>
      <span v-if="data">{{ t('storage.files.count', { n: items.length }, items.length) }}</span>
      <span v-if="!readonly" class="ml-auto">{{ t('storage.files.dropHint') }}</span>
    </div>

    <!-- drop overlay -->
    <div
      v-if="dragging"
      class="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-primary-tint/85 text-primary-strong"
    >
      <div class="flex flex-col items-center gap-1.5">
        <UploadCloud :size="26" aria-hidden="true" />
        <div class="text-md font-bold">{{ t('storage.files.dropHere', { path: rootLabel + prefix }) }}</div>
      </div>
    </div>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="t('storage.files.deleteTitle', { name: toDelete ? baseName(toDelete.key) : '' })"
      :description="t('storage.files.deleteBody')"
      :confirm-label="t('storage.files.delete')"
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </section>
</template>
