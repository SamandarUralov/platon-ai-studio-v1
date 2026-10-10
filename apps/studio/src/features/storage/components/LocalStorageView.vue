<script setup lang="ts">
/** The app server's filesystem: disk usage, non-replication warning and the declared folders. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Archive,
  ChevronRight,
  Cloud,
  Folder,
  FolderPlus,
  HardDrive,
  Server,
  TriangleAlert,
} from 'lucide-vue-next'
import { PBadge, PButton, PSpinner } from '@platon/ui'
import { parseSize, type AppDefinition, type LocalStorageStatus } from '@platon/definition'
import { fmtBytes, relTime } from '@/composables/format'
import { projectLinks } from '@/composables/useProject'
import { isNearFull, usagePct } from '../utils'
import { useLabels } from '../useLabels'
import StatCard from './StatCard.vue'
import UsageBar from './UsageBar.vue'

const props = defineProps<{
  projectId: string
  definition: AppDefinition
  status?: LocalStorageStatus
  loading?: boolean
}>()
const emit = defineEmits<{ addFolder: [] }>()
const { t } = useI18n()
const labels = useLabels()
const router = useRouter()
const links = computed(() => projectLinks(props.projectId))

const local = computed(() => props.definition.storage.local)
const rows = computed(() =>
  local.value.folders.map((f) => {
    const s = props.status?.folders.find((x) => x.id === f.id)
    const quota = parseSize(f.quota)
    return { f, s, quota, warn: !!s && isNearFull(s.usedBytes, quota) }
  }),
)
const targets = computed(() => {
  const ids = new Set(
    local.value.folders.filter((f) => f.backup?.enabled && f.backup.target).map((f) => f.backup!.target!),
  )
  return props.definition.storage.object.filter((s) => ids.has(s.id)).map((s) => s.name)
})
const diskWarn = computed(() => !!props.status && isNearFull(props.status.usedBytes, props.status.totalBytes))
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-3">
      <div class="grid size-10 place-items-center rounded-[10px] bg-warn-bg text-warn">
        <Server :size="19" />
      </div>
      <div class="min-w-0">
        <h1 class="m-0 text-[22px] font-extrabold tracking-tight">{{ t('storage.local.title') }}</h1>
        <div class="mt-0.5 text-sm text-faint">
          <template v-if="status">{{ status.host }} · {{ status.os }} · </template
          ><span class="font-mono">{{ local.root }}</span>
        </div>
      </div>
      <PButton class="ml-auto" :icon="FolderPlus" @click="emit('addFolder')">{{
        t('storage.local.addFolder')
      }}</PButton>
    </div>

    <div class="mb-3 mt-5 rounded-xl border border-line-2 bg-surface px-4 py-3.5">
      <div class="flex flex-wrap items-baseline gap-2">
        <span class="text-base font-bold">{{ t('storage.local.diskUsage') }}</span>
        <span v-if="status" class="text-sm text-muted"
          >{{
            t('storage.local.diskOf', {
              used: fmtBytes(status.usedBytes),
              total: fmtBytes(status.totalBytes),
            })
          }}
          · {{ t('storage.env.development') }}</span
        >
        <span v-if="status" class="ml-auto text-base font-bold" :class="diskWarn && 'text-warn'"
          >{{ usagePct(status.usedBytes, status.totalBytes) }}%</span
        >
      </div>
      <div v-if="loading" class="mt-2 grid place-items-center"><PSpinner /></div>
      <UsageBar
        v-else-if="status"
        class="mt-2.5"
        :used="status.usedBytes"
        :total="status.totalBytes"
        :label="t('storage.local.diskUsage')"
      />
      <p v-if="diskWarn" class="m-0 mt-2 text-sm text-warn">{{ t('storage.local.diskWarnLong') }}</p>
    </div>

    <div class="mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
      <StatCard
        :label="t('storage.local.free')"
        :value="status ? fmtBytes(status.totalBytes - status.usedBytes) : '…'"
        :icon="HardDrive"
      />
      <StatCard :label="t('storage.local.folders')" :value="String(local.folders.length)" :icon="Folder" />
      <StatCard
        :label="t('storage.local.lastBackup')"
        :value="status ? relTime(status.lastBackupAt) : '…'"
        :icon="Archive"
      />
      <StatCard :label="t('storage.local.backsUpTo')" :value="targets.join(', ') || '—'" :icon="Cloud" />
    </div>

    <div
      class="mb-6 flex gap-2.5 rounded-xl border border-warn/30 bg-warn-bg px-3.5 py-3 text-sm leading-relaxed text-warn"
    >
      <TriangleAlert :size="15" class="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{{ t('storage.local.noReplication') }}</span>
    </div>

    <div class="mb-2.5 flex items-center gap-2.5">
      <h2 class="m-0 text-xl font-bold">{{ t('storage.local.folders') }}</h2>
      <span class="text-sm text-faint">{{ t('storage.local.foldersHint') }}</span>
    </div>
    <div class="overflow-x-auto rounded-xl border border-line-2 bg-surface">
      <table class="w-full min-w-[820px] border-collapse text-base">
        <thead>
          <tr class="border-b border-line-faint bg-subtle text-left text-xs font-semibold text-muted">
            <th class="px-4 py-2.5 font-semibold">{{ t('storage.folder.path') }}</th>
            <th class="px-4 py-2.5 font-semibold">{{ t('storage.folder.purpose') }}</th>
            <th class="w-[190px] px-4 py-2.5 font-semibold">{{ t('storage.folder.size') }}</th>
            <th class="px-4 py-2.5 font-semibold">{{ t('storage.folder.access') }}</th>
            <th class="px-4 py-2.5 font-semibold">{{ t('storage.folder.cleanup') }}</th>
            <th class="px-4 py-2.5 font-semibold">{{ t('storage.folder.backup') }}</th>
            <th class="w-10" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.f.id"
            tabindex="0"
            class="cursor-pointer border-b border-line-faint last:border-b-0 hover:bg-hover"
            @click="router.push(links.storage('local', r.f.id))"
            @keydown.enter="router.push(links.storage('local', r.f.id))"
          >
            <td class="px-4 py-2.5">
              <span class="flex items-center gap-2 font-mono text-sm"
                ><Folder :size="14" class="text-warn" aria-hidden="true" />{{ r.f.path }}/</span
              >
            </td>
            <td class="px-4 py-2.5 text-fg-2">{{ r.s?.purpose || '—' }}</td>
            <td class="px-4 py-2.5">
              <div
                class="flex items-center gap-1.5 text-sm"
                :class="r.warn ? 'font-semibold text-warn' : 'text-fg-2'"
              >
                <TriangleAlert v-if="r.warn" :size="12" />{{ r.s ? fmtBytes(r.s.usedBytes) : '…' }} /
                {{ r.f.quota }}
              </div>
              <UsageBar
                class="mt-1.5"
                size="sm"
                :used="r.s?.usedBytes ?? 0"
                :total="r.quota"
                :label="r.f.path"
              />
            </td>
            <td class="px-4 py-2.5 text-fg-2">{{ t(`storage.folderAccess.${r.f.access}`) }}</td>
            <td class="px-4 py-2.5 text-fg-2">{{ labels.cleanup(r.f.cleanup) }}</td>
            <td class="px-4 py-2.5">
              <PBadge size="xs" :tone="r.f.backup?.enabled ? 'ok' : 'neutral'">{{
                r.f.backup?.enabled ? t('storage.common.on') : t('storage.common.off')
              }}</PBadge>
            </td>
            <td class="pr-3 text-faint"><ChevronRight :size="15" /></td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="7" class="px-4 py-6 text-center text-faint">{{ t('storage.local.noFolders') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
