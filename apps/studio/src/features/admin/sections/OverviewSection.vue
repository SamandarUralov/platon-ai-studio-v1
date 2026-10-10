<script setup lang="ts">
/** Overview: headline numbers, things that need attention and the latest admin activity. */
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Box,
  Database,
  FolderKanban,
  Info,
  Sparkles,
  TriangleAlert,
  UserX,
  Users,
} from 'lucide-vue-next'
import { PBadge, PSpinner, cn } from '@platon/ui'
import { relTime } from '@/composables/format'
import AdminCard from '../components/AdminCard.vue'
import { useOverview } from '../api'

const { t } = useI18n()
const router = useRouter()
const o = useOverview()

const pct = computed(() =>
  o.data.value ? Math.round((o.data.value.aiSpent / Math.max(1, o.data.value.aiBudget)) * 100) : 0,
)
const stats = computed(() => {
  const d = o.data.value
  if (!d) return []
  return [
    {
      icon: Users,
      label: t('admin.overview.activeUsers'),
      value: String(d.activeUsers),
      sub: t('admin.overview.inStudio'),
      to: 'users',
    },
    {
      icon: FolderKanban,
      label: t('admin.overview.projects'),
      value: String(d.projects),
      sub: t('admin.overview.notArchived'),
      to: 'projects',
    },
    {
      icon: Sparkles,
      label: t('admin.overview.aiSpend'),
      value: `$${d.aiSpent.toLocaleString()}`,
      sub: t('admin.overview.ofBudget', { pct: pct.value, budget: d.aiBudget.toLocaleString() }),
      to: 'ai',
    },
    {
      icon: Database,
      label: t('admin.overview.disk'),
      value: `${d.dbDiskUsedGb} GB`,
      sub: t('admin.overview.engines', { n: d.enginesRunning }),
      to: 'databases',
    },
  ]
})

interface Alert {
  icon: Component
  text: string
  to: string
  tone: 'warn' | 'danger' | 'neutral'
}
const alerts = computed<Alert[]>(() => {
  const d = o.data.value
  if (!d) return []
  const out: Alert[] = []
  if (pct.value >= d.aiWarnAt)
    out.push({
      icon: TriangleAlert,
      text: t('admin.overview.alertBudget', { pct: pct.value }),
      to: 'ai',
      tone: pct.value >= 100 ? 'danger' : 'warn',
    })
  if (d.sandboxUpdates)
    out.push({
      icon: Box,
      text: t('admin.overview.alertSandbox', { n: d.sandboxUpdates }),
      to: 'sandboxes',
      tone: 'warn',
    })
  for (const p of d.projectsWithoutRelease)
    out.push({
      icon: Info,
      text: t('admin.overview.alertNoRelease', { name: p }),
      to: 'projects',
      tone: 'neutral',
    })
  if (d.inactiveUsers)
    out.push({
      icon: UserX,
      text: t('admin.overview.alertInactive', { n: d.inactiveUsers }),
      to: 'users',
      tone: 'neutral',
    })
  return out
})
const ALERT_CLS = {
  warn: 'bg-warn-bg text-warn',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-subtle text-fg-2',
}
const go = (section: string) => router.push({ name: 'admin', params: { section } })
</script>

<template>
  <div v-if="o.isLoading.value" class="grid place-items-center py-16 text-muted"><PSpinner :size="20" /></div>
  <template v-else-if="o.data.value">
    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
      <button
        v-for="s in stats"
        :key="s.label"
        type="button"
        class="rounded-[14px] border border-line-2 bg-surface p-4 text-left hover:border-line hover:shadow-card"
        @click="go(s.to)"
      >
        <div class="flex items-center gap-1.5 text-sm font-semibold text-muted">
          <component :is="s.icon" :size="14" />{{ s.label }}
        </div>
        <div class="mt-2 text-[22px] font-extrabold tracking-[-0.01em]">{{ s.value }}</div>
        <div class="mt-0.5 text-xs text-faint">{{ s.sub }}</div>
      </button>
    </div>

    <h2 class="text-[15.5px] font-bold">{{ t('admin.overview.attention') }}</h2>
    <div class="flex flex-col gap-2">
      <button
        v-for="(a, i) in alerts"
        :key="i"
        type="button"
        :class="cn('flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-base', ALERT_CLS[a.tone])"
        @click="go(a.to)"
      >
        <component :is="a.icon" :size="15" class="shrink-0" /><span class="flex-1">{{ a.text }}</span
        ><ArrowRight :size="14" class="shrink-0 opacity-60" />
      </button>
      <div v-if="!alerts.length" class="rounded-xl bg-ok-bg px-3.5 py-3 text-base text-ok">
        {{ t('admin.overview.allGood') }}
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <h2 class="text-[15.5px] font-bold">{{ t('admin.overview.recent') }}</h2>
      <RouterLink
        :to="{ name: 'admin', params: { section: 'audit' } }"
        class="ml-auto text-sm font-semibold text-primary-strong hover:underline"
        >{{ t('admin.overview.allActivity') }}</RouterLink
      >
    </div>
    <AdminCard>
      <div
        v-for="x in o.data.value.recent"
        :key="x.id"
        class="flex items-center gap-3 border-b border-line-faint px-4 py-[11px] text-base last:border-b-0"
      >
        <span class="w-[96px] shrink-0 text-xs text-faint">{{ relTime(x.at) }}</span>
        <span class="min-w-0 flex-1">{{ x.text }}</span>
        <span class="text-xs text-muted">{{ x.who }}</span>
        <PBadge size="xs">{{ t(`admin.areas.${x.area}`) }}</PBadge>
      </div>
    </AdminCard>
  </template>
</template>
