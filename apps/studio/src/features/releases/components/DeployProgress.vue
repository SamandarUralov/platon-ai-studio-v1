<script setup lang="ts">
/** Live steps of one deployment job (validate → migrations → provisioning → deploy). */
import { computed, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Circle,
  CircleCheck,
  CircleMinus,
  CircleX,
  LoaderCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-vue-next'
import type { DeploymentJob, DeployStep } from '@platon/definition'
import { PSpinner } from '@platon/ui'
import { useConsoleLog } from '@/features/console/useConsoleLog'
import { useDeploymentJob } from '../api'

const props = defineProps<{ projectId: string; jobId: string }>()
const emit = defineEmits<{ finished: [job: DeploymentJob] }>()
const { t } = useI18n()
const log = useConsoleLog()

const q = useDeploymentJob(toRef(props, 'projectId'), toRef(props, 'jobId'))
const job = computed(() => q.data.value)

const ICON: Record<DeployStep['status'], { icon: typeof Circle; cls: string }> = {
  pending: { icon: Circle, cls: 'text-faint-2' },
  running: { icon: LoaderCircle, cls: 'animate-spin text-primary' },
  done: { icon: CircleCheck, cls: 'text-ok-dot' },
  skipped: { icon: CircleMinus, cls: 'text-faint' },
  failed: { icon: CircleX, cls: 'text-danger-dot' },
}

let announced = ''
watch(job, (j, prev) => {
  if (!j) return
  if (announced !== j.id + j.status) {
    announced = j.id + j.status
    const env = t(`releases.env.${j.env}`)
    if (j.status === 'running' && !prev)
      log.push({
        level: 'info',
        source: 'releases',
        message: t('releases.log.started', { name: j.releaseName, env }),
      })
    if (j.status === 'succeeded')
      log.push({
        level: 'info',
        source: 'releases',
        message: t('releases.log.succeeded', { name: j.releaseName, env }),
      })
    if (j.status === 'failed')
      log.push({
        level: 'error',
        source: 'releases',
        message: t('releases.log.failed', { name: j.releaseName, env, error: j.error ?? '' }),
      })
    if (j.status === 'awaiting_approval')
      log.push({
        level: 'warn',
        source: 'releases',
        message: t('releases.log.approval', { name: j.releaseName }),
      })
  }
  if (j.status !== 'running') emit('finished', j)
})
</script>

<template>
  <div v-if="!job" class="flex items-center gap-2 py-6 text-muted">
    <PSpinner :size="14" />{{ t('releases.starting') }}
  </div>
  <div
    v-else-if="job.status === 'awaiting_approval'"
    class="flex items-start gap-3 rounded-xl border border-purple/30 bg-purple-bg px-4 py-3 text-purple"
  >
    <UserCheck :size="18" class="mt-0.5 shrink-0" />
    <div class="text-base">
      <div class="font-bold">{{ t('releases.approvalRequested', { name: job.releaseName }) }}</div>
      <div class="mt-0.5 text-sm opacity-90">{{ t('releases.approvalRequestedHint') }}</div>
    </div>
  </div>
  <ol v-else class="m-0 flex list-none flex-col gap-0 p-0">
    <li v-for="(s, i) in job.steps" :key="s.id" class="relative flex gap-3 pb-3.5 last:pb-0">
      <span
        v-if="i < job.steps.length - 1"
        class="absolute left-[8.5px] top-5 h-[calc(100%-16px)] w-px bg-line"
        aria-hidden="true"
      />
      <component
        :is="ICON[s.status].icon"
        :size="18"
        class="relative shrink-0 bg-surface"
        :class="ICON[s.status].cls"
      />
      <div class="min-w-0 flex-1">
        <div class="text-base font-semibold" :class="s.status === 'pending' ? 'text-faint' : 'text-fg'">
          {{ t(`releases.step.${s.id}`) }}
        </div>
        <div v-if="s.detail" class="text-sm" :class="s.status === 'failed' ? 'text-danger' : 'text-muted'">
          {{ s.detail }}
        </div>
      </div>
    </li>
    <li
      v-if="job.status === 'succeeded'"
      class="mt-3 flex items-center gap-2 rounded-lg bg-ok-bg px-3 py-2 text-sm font-semibold text-ok"
    >
      <ShieldCheck :size="15" />{{
        t('releases.liveNow', { name: job.releaseName, env: t(`releases.env.${job.env}`) })
      }}
    </li>
  </ol>
</template>
