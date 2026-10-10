<script setup lang="ts">
/** Development / Staging / Production: what runs where, when it got there and who put it there. */
import { useI18n } from 'vue-i18n'
import { Activity, UserCheck } from 'lucide-vue-next'
import type { EnvironmentState } from '@platon/definition'
import { PBadge, PButton, PStatusDot, toneClasses } from '@platon/ui'
import { useSessionStore } from '@/stores/session'
import { relTime } from '@/composables/format'
import { ENV_META, STATUS_TONE } from '../envs'

defineProps<{ environments: EnvironmentState[]; unreleased: number }>()
const emit = defineEmits<{ approve: [env: EnvironmentState]; openJob: [jobId: string] }>()
const { t } = useI18n()
const session = useSessionStore()
</script>

<template>
  <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
    <div
      v-for="e in environments"
      :key="e.env"
      class="flex flex-col gap-2.5 rounded-xl border border-line-2 bg-surface px-4 py-3.5"
    >
      <div class="flex items-center gap-3">
        <div
          class="grid size-[34px] shrink-0 place-items-center rounded-[9px]"
          :class="[toneClasses[ENV_META[e.env].tone].bg, toneClasses[ENV_META[e.env].tone].fg]"
        >
          <component :is="ENV_META[e.env].icon" :size="16" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-muted">{{ t(`releases.env.${e.env}`) }}</div>
          <div class="flex items-center gap-2">
            <span class="text-lg font-bold">{{ e.releaseName ?? '—' }}</span>
            <PBadge v-if="e.status !== 'idle'" :tone="STATUS_TONE[e.status]" size="xs" dot>{{
              t(`releases.status.${e.status}`)
            }}</PBadge>
          </div>
        </div>
      </div>
      <div class="text-xs text-faint">
        <template v-if="e.at">{{
          t('releases.deployedBy', { when: relTime(e.at), who: e.by ?? '—' })
        }}</template>
        <template v-else>{{ t('releases.neverDeployed') }}</template>
        <template v-if="e.env === 'development'">
          · <b class="text-fg-2">{{ t('releases.unreleasedN', { n: unreleased }, unreleased) }}</b></template
        >
      </div>

      <button
        v-if="e.jobId && e.status === 'running'"
        type="button"
        class="flex items-center gap-2 rounded-lg bg-primary-tint px-2.5 py-1.5 text-left text-xs font-semibold text-primary-strong hover:bg-primary-soft"
        @click="emit('openJob', e.jobId)"
      >
        <PStatusDot tone="primary" pulse /><Activity :size="12" />{{ t('releases.deployingNow') }}
      </button>
      <div
        v-if="e.pending"
        class="flex flex-wrap items-center gap-2 rounded-lg bg-purple-bg px-2.5 py-1.5 text-xs text-purple"
      >
        <UserCheck :size="13" />
        <span class="min-w-0 flex-1">{{
          t('releases.pendingApproval', { name: e.pending.releaseName, who: e.pending.requestedBy })
        }}</span>
        <PButton v-if="session.canDeployProduction" size="xs" variant="ink" @click="emit('approve', e)">{{
          t('releases.approve')
        }}</PButton>
      </div>
    </div>
  </div>
</template>
