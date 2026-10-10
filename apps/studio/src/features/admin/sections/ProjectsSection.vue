<script setup lang="ts">
/** Projects: every app in the organisation. Admins can open any project (audited) and archive/restore. */
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { ExternalLink, FolderKanban } from 'lucide-vue-next'
import { PBadge, PButton, PSpinner, type Tone } from '@platon/ui'
import type { AdminProject, AdminProjectStatus } from '@platon/definition'
import { fmtBytes, fmtDate } from '@/composables/format'
import { http } from '@/services/http'
import AdminCard from '../components/AdminCard.vue'
import { adminKeys, useAdminMutation, useAdminProjects } from '../api'

const { t } = useI18n()
const router = useRouter()
const qc = useQueryClient()
const projects = useAdminProjects()

const TONE: Record<AdminProjectStatus, Tone> = {
  live: 'ok',
  staging: 'primary',
  draft: 'neutral',
  archived: 'neutral',
}
const archive = useAdminMutation(
  async (p: AdminProject) =>
    (await http.patch<AdminProject>(`/admin/projects/${p.id}`, { archived: p.status !== 'archived' })).data,
  {
    key: adminKeys.projects,
    set: (r) => (projects.data.value ?? []).map((x) => (x.id === r.id ? r : x)),
    success: (r) =>
      r.status === 'archived'
        ? t('admin.projects.archived', { name: r.name })
        : t('admin.projects.restored', { name: r.name }),
  },
)
async function open(p: AdminProject) {
  await http.post(`/admin/projects/${p.id}/open`)
  void qc.invalidateQueries({ queryKey: ['admin', 'audit'] })
  await router.push({ name: 'interface', params: { projectId: p.id } })
}
</script>

<template>
  <div v-if="projects.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <AdminCard v-else>
    <div class="overflow-x-auto scroll-thin">
      <div class="min-w-[900px]">
        <div
          class="grid grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.9fr)_60px_90px_minmax(130px,0.9fr)_100px_170px] border-b border-line-soft bg-bg-home text-xs font-semibold text-muted"
        >
          <div class="px-3.5 py-2.5">{{ t('admin.projects.project') }}</div>
          <div class="px-3.5 py-2.5">{{ t('admin.projects.owner') }}</div>
          <div class="px-3.5 py-2.5">{{ t('admin.projects.envs') }}</div>
          <div class="px-3.5 py-2.5">{{ t('admin.projects.size') }}</div>
          <div class="px-3.5 py-2.5">{{ t('admin.projects.release') }}</div>
          <div class="px-3.5 py-2.5">{{ t('admin.projects.status') }}</div>
          <div />
        </div>
        <div
          v-for="p in projects.data.value"
          :key="p.id"
          class="grid grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.9fr)_60px_90px_minmax(130px,0.9fr)_100px_170px] items-center border-b border-line-faint text-base last:border-b-0"
        >
          <div class="flex min-w-0 items-center gap-2 px-3.5 py-[11px] font-semibold">
            <FolderKanban :size="14" class="shrink-0 text-faint-2" /><span class="truncate">{{
              p.name
            }}</span>
          </div>
          <div class="px-3.5 py-[11px] text-fg-2">{{ p.owner }}</div>
          <div class="px-3.5 py-[11px] text-fg-2">{{ p.envs }}</div>
          <div class="px-3.5 py-[11px] text-fg-2">{{ fmtBytes(p.sizeBytes) }}</div>
          <div class="px-3.5 py-[11px] text-fg-2">
            {{
              p.lastRelease
                ? `${p.lastRelease}${p.releasedAt ? ` · ${fmtDate(p.releasedAt, 'MMM D')}` : ''}`
                : '—'
            }}
          </div>
          <div class="px-3.5 py-[11px]">
            <PBadge size="xs" :tone="TONE[p.status]">{{ t(`admin.projects.st.${p.status}`) }}</PBadge>
          </div>
          <div class="flex justify-end gap-1.5 px-3.5 py-2">
            <PButton size="xs" @click="archive.mutate(p)">{{
              p.status === 'archived' ? t('admin.projects.restore') : t('admin.projects.archive')
            }}</PButton>
            <PButton
              size="xs"
              variant="ink"
              :icon-right="ExternalLink"
              :disabled="p.status === 'archived'"
              @click="open(p)"
              >{{ t('admin.projects.open') }}</PButton
            >
          </div>
        </div>
      </div>
    </div>
  </AdminCard>
  <p class="text-xs text-faint">{{ t('admin.projects.note') }}</p>
</template>
