<script setup lang="ts">
/**
 * Storage layer (requirements §3.5): object storage (MinIO / S3) and the app server's local folders.
 * Route: storage/:kind?/:itemId? — kind = object | local; `?bucket=` opens a bucket's file browser.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { SearchX, Sparkles, X } from 'lucide-vue-next'
import { PButton, PEmptyState } from '@platon/ui'
import LayerShell from '@/components/shell/LayerShell.vue'
import PanelHeader from '@/components/shell/PanelHeader.vue'
import AiPanel from '@/features/ai/AiPanel.vue'
import type { AiContext } from '@/features/ai/types'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useDefinitionStore } from '@/stores/definition'
import { storageKeys, useLocalStatus, useObjectStatus } from './api'
import AddFolderDialog from './components/AddFolderDialog.vue'
import BucketView from './components/BucketView.vue'
import ConnectStorageDialog from './components/ConnectStorageDialog.vue'
import FolderView from './components/FolderView.vue'
import LocalStorageView from './components/LocalStorageView.vue'
import ObjectStorageView from './components/ObjectStorageView.vue'
import StorageNav from './components/StorageNav.vue'
import StorageOverview from './components/StorageOverview.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const def = useDefinitionStore()
const projectId = useProjectId()

const kind = computed(() => {
  const k = route.params.kind
  return k === 'object' || k === 'local' ? k : undefined
})
const itemId = computed(() => (route.params.itemId ? String(route.params.itemId) : undefined))
const bucketName = computed(() => (typeof route.query.bucket === 'string' ? route.query.bucket : undefined))

const definition = computed(() => def.definition!)
const storage = computed(() =>
  kind.value === 'object' ? definition.value.storage.object.find((s) => s.id === itemId.value) : undefined,
)
const bucket = computed(() =>
  storage.value && bucketName.value
    ? storage.value.buckets.find((b) => b.name === bucketName.value)
    : undefined,
)
const folder = computed(() =>
  kind.value === 'local' && itemId.value
    ? definition.value.storage.local.folders.find((f) => f.id === itemId.value)
    : undefined,
)

const objectQ = useObjectStatus(projectId)
const localQ = useLocalStatus(projectId)
// Stats are keyed by what the definition declares; refetch once a structural edit reached the server.
const qc = useQueryClient()
const structure = computed(() =>
  JSON.stringify([
    definition.value.storage.object.map((s) => [s.id, s.buckets.map((b) => b.name)]),
    definition.value.storage.local.folders.map((f) => f.id),
  ]),
)
let stale = false
watch(structure, () => (stale = true))
watch([structure, () => def.sync], () => {
  if (!stale || def.sync === 'saving') return
  stale = false
  void qc.invalidateQueries({ queryKey: storageKeys.all(projectId.value) })
})
const storageStatus = computed(() => objectQ.data.value?.find((s) => s.id === storage.value?.id))

const view = computed(() => {
  if (!kind.value) return 'overview'
  if (kind.value === 'object')
    return storage.value ? (bucketName.value ? (bucket.value ? 'bucket' : 'missing') : 'object') : 'missing'
  if (!itemId.value) return 'local'
  return folder.value ? 'folder' : 'missing'
})

const connectOpen = ref(false)
const addFolderOpen = ref(false)
function addFolder() {
  addFolderOpen.value = true
}

const aiContext = computed<AiContext>(() => {
  if (bucket.value && storage.value)
    return {
      kind: 'storage',
      path: `/storage/object/${storage.value.id}/buckets/${bucket.value.name}`,
      label: `${storage.value.name} · ${bucket.value.name}`,
    }
  if (storage.value)
    return { kind: 'storage', path: `/storage/object/${storage.value.id}`, label: storage.value.name }
  if (folder.value)
    return {
      kind: 'storage',
      path: `/storage/local/folders/${folder.value.id}`,
      label: `${folder.value.path}/`,
    }
  if (kind.value === 'local')
    return { kind: 'storage', path: '/storage/local', label: t('storage.local.title') }
  return { kind: 'storage', path: '/storage', label: t('storage.title') }
})
</script>

<template>
  <LayerShell>
    <template #left>
      <StorageNav
        :project-id="projectId"
        :definition="definition"
        :local="localQ.data.value"
        :kind="kind"
        :item-id="itemId"
        :bucket="bucketName"
        @connect="connectOpen = true"
        @add-folder="addFolder"
      />
    </template>

    <div class="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div class="mx-auto max-w-[1180px] px-7 pb-12 pt-6">
        <StorageOverview
          v-if="view === 'overview'"
          :project-id="projectId"
          :definition="definition"
          :status="objectQ.data.value"
          :local="localQ.data.value"
          :local-loading="localQ.isLoading.value"
          @connect="connectOpen = true"
        />
        <BucketView
          v-else-if="view === 'bucket' && storage && bucket"
          :key="`${storage.id}/${bucket.name}`"
          :project-id="projectId"
          :storage="storage"
          :bucket="bucket"
          :stats="storageStatus?.buckets.find((b) => b.name === bucket!.name)"
        />
        <ObjectStorageView
          v-else-if="view === 'object' && storage"
          :key="storage.id"
          :project-id="projectId"
          :definition="definition"
          :storage="storage"
          :status="storageStatus"
        />
        <LocalStorageView
          v-else-if="view === 'local'"
          :project-id="projectId"
          :definition="definition"
          :status="localQ.data.value"
          :loading="localQ.isLoading.value"
          @add-folder="addFolder"
        />
        <FolderView
          v-else-if="view === 'folder' && folder"
          :key="folder.id"
          :project-id="projectId"
          :definition="definition"
          :folder="folder"
          :status="localQ.data.value?.folders.find((f) => f.id === folder!.id)"
        />
        <PEmptyState
          v-else
          :icon="SearchX"
          :title="t('storage.missing.title')"
          :description="t('storage.missing.body')"
        >
          <PButton variant="ink" @click="router.push(projectLinks(projectId).storage())">{{
            t('storage.missing.back')
          }}</PButton>
        </PEmptyState>
      </div>
    </div>

    <template #right="{ close }">
      <PanelHeader :title="t('storage.ai')">
        <Sparkles :size="15" class="text-ai" />
        <PButton
          square
          size="xs"
          variant="ghost"
          :icon="X"
          :label="t('storage.common.close')"
          @click="close"
        />
      </PanelHeader>
      <AiPanel :context="aiContext" />
    </template>
    <template #right-rail>
      <Sparkles :size="16" class="mt-1 text-ai" aria-hidden="true" />
    </template>

    <ConnectStorageDialog
      v-model:open="connectOpen"
      :project-id="projectId"
      :taken="definition.storage.object.map((s) => s.id)"
    />
    <AddFolderDialog v-model:open="addFolderOpen" :project-id="projectId" :local="definition.storage.local" />
  </LayerShell>
</template>
