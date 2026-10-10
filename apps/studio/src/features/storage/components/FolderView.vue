<script setup lang="ts">
/** One local folder: usage vs quota (with "almost full" warning), settings and its files. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowLeft, Folder, Trash2, TriangleAlert } from 'lucide-vue-next'
import { PButton, PTooltip, toast } from '@platon/ui'
import { parseSize, type AppDefinition, type LocalFolder, type LocalFolderStatus } from '@platon/definition'
import { fmtBytes } from '@/composables/format'
import { projectLinks } from '@/composables/useProject'
import { localBase } from '../api'
import { useStorageEdits } from '../useStorageEdits'
import { isNearFull, usagePct } from '../utils'
import ConfirmDialog from './ConfirmDialog.vue'
import FileBrowser from './FileBrowser.vue'
import FolderSettings from './FolderSettings.vue'
import UsageBar from './UsageBar.vue'

const props = defineProps<{
  projectId: string
  definition: AppDefinition
  folder: LocalFolder
  status?: LocalFolderStatus
}>()
const { t } = useI18n()
const router = useRouter()
const edits = useStorageEdits()
const links = computed(() => projectLinks(props.projectId))

const quota = computed(() => parseSize(props.folder.quota))
const used = computed(() => props.status?.usedBytes ?? 0)
const full = computed(() => !!props.status && isNearFull(used.value, quota.value))
const root = computed(() => props.definition.storage.local.root)

const confirmOpen = ref(false)
function remove() {
  const path = props.folder.path
  if (edits.removeFolder(props.folder)) {
    confirmOpen.value = false
    toast(t('storage.folder.removed', { path }))
    void router.push(links.value.storage('local'))
  }
}
</script>

<template>
  <div>
    <button
      type="button"
      class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
      @click="router.push(links.storage('local'))"
    >
      <ArrowLeft :size="13" />{{ t('storage.local.title') }}
    </button>
    <div class="flex flex-wrap items-center gap-3">
      <div class="grid size-10 place-items-center rounded-[10px] bg-warn-bg text-warn">
        <Folder :size="19" />
      </div>
      <div class="min-w-0">
        <h1 class="m-0 truncate font-mono text-[20px] font-bold">{{ folder.path }}/</h1>
        <div class="mt-0.5 text-sm text-faint">
          <template v-if="status?.purpose">{{ status.purpose }} · </template
          ><span class="font-mono">{{ root }}/{{ folder.path }}/</span>
        </div>
      </div>
      <div class="ml-auto">
        <PTooltip :text="t('storage.folder.remove')">
          <PButton
            square
            variant="danger"
            :icon="Trash2"
            :label="t('storage.folder.remove')"
            @click="confirmOpen = true"
          />
        </PTooltip>
      </div>
    </div>

    <div class="mb-3.5 mt-5 rounded-xl border border-line-2 bg-surface px-4 py-3.5">
      <div class="flex flex-wrap items-baseline gap-2">
        <span class="text-base font-bold" :class="full && 'text-warn'">{{
          t('storage.local.usedOf', { used: status ? fmtBytes(used) : '…', quota: folder.quota })
        }}</span>
        <span class="text-sm text-muted"
          >{{ t('storage.env.development')
          }}<template v-if="Number.isFinite(quota)"> · {{ usagePct(used, quota) }}%</template></span
        >
        <span class="ml-auto text-sm text-faint">
          {{ t('storage.folder.functionsUse') }}
          <span class="font-mono text-fg-2">local://{{ folder.path }}/</span>
        </span>
      </div>
      <UsageBar class="mt-2.5" :used="used" :total="quota" :label="folder.path" />
      <p v-if="full" class="m-0 mt-2 flex items-center gap-1.5 text-sm text-warn">
        <TriangleAlert :size="13" />{{ t('storage.folder.almostFull') }}
      </p>
    </div>

    <FolderSettings :folder="folder" :storages="definition.storage.object" />

    <div class="mb-2.5 mt-7 flex items-center gap-2.5">
      <h2 class="m-0 text-xl font-bold">{{ t('storage.files.title') }}</h2>
      <span class="text-sm text-faint">{{ t('storage.files.devServer') }}</span>
    </div>
    <FileBrowser :base="localBase(projectId, folder.id)" :root-label="`${folder.path}/`" />

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="t('storage.folder.removeTitle', { path: folder.path })"
      :description="t('storage.folder.removeBody')"
      :confirm-label="t('storage.folder.remove')"
      @confirm="remove"
    />
  </div>
</template>
