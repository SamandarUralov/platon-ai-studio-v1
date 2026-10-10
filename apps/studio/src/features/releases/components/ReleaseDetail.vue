<script setup lang="ts">
/** One released version: what changed vs. the previous release, its migrations, where it runs; deploy/rollback. */
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { History, Rocket, RotateCcw, UserCheck } from 'lucide-vue-next'
import type { EnvironmentState, EnvName, Release } from '@platon/definition'
import {
  PBadge,
  PButton,
  PDialog,
  PEmptyState,
  PSegmented,
  PSpinner,
  toast,
  type SegmentOption,
} from '@platon/ui'
import { useSessionStore } from '@/stores/session'
import { errorMessage } from '@/services/http'
import { fmtDate } from '@/composables/format'
import { useConsoleLog } from '@/features/console/useConsoleLog'
import { useReleaseCommands, useReleaseDetail } from '../api'
import { ENV_META, STATUS_TONE } from '../envs'
import ChangeList from './ChangeList.vue'
import MigrationList from './MigrationList.vue'

const props = defineProps<{
  projectId: string
  release: Release
  releases: Release[]
  environments: EnvironmentState[]
}>()
const mode = defineModel<'plain' | 'definition'>('mode', { required: true })
const emit = defineEmits<{ openJob: [jobId: string] }>()
const { t } = useI18n()
const session = useSessionStore()
const log = useConsoleLog()
const detail = useReleaseDetail(
  toRef(props, 'projectId'),
  computed(() => props.release.id),
)
const cmd = useReleaseCommands(toRef(props, 'projectId'))

const created = (id: string | null) => props.releases.find((r) => r.id === id)?.createdAt ?? ''
const liveOn = computed(() => props.environments.filter((e) => e.releaseId === props.release.id))
const previous = computed(() => {
  const i = props.releases.findIndex((r) => r.id === props.release.id)
  return props.releases[i + 1] ?? null
})

/** Envs this version can be promoted to (newer than what runs there). */
const promote = computed(() =>
  props.environments.filter(
    (e) =>
      e.releaseId !== props.release.id &&
      (!e.releaseId || created(e.releaseId) < props.release.createdAt) &&
      e.status !== 'running',
  ),
)
/** Envs that run a newer version and had this one before. */
const rollbackTo = computed(() =>
  props.environments.filter(
    (e) =>
      e.releaseId &&
      e.releaseId !== props.release.id &&
      created(e.releaseId) > props.release.createdAt &&
      props.release.deployments.some((d) => d.env === e.env) &&
      e.status !== 'running',
  ),
)

const busy = ref<string | null>(null)
async function deploy(env: EnvName) {
  busy.value = `deploy:${env}`
  try {
    const job = await cmd.deploy(props.release.id, env)
    if (job.status === 'awaiting_approval')
      toast(t('releases.approvalRequested', { name: props.release.name }), { tone: 'ok' })
    else emit('openJob', job.id)
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    busy.value = null
  }
}

const confirm = ref<EnvironmentState | null>(null)
const confirmOpen = computed({ get: () => !!confirm.value, set: (v) => (v ? null : (confirm.value = null)) })
async function rollback() {
  const e = confirm.value
  if (!e) return
  busy.value = `rollback:${e.env}`
  try {
    await cmd.rollback(props.release.id, e.env)
    const env = t(`releases.env.${e.env}`)
    toast(t('releases.rolledBack', { env, name: props.release.name }), { tone: 'ok' })
    log.push({
      level: 'warn',
      source: 'releases',
      message: t('releases.log.rolledBack', { env, name: props.release.name, from: e.releaseName ?? '' }),
    })
    confirm.value = null
  } catch (err) {
    toast(errorMessage(err), { tone: 'danger' })
  } finally {
    busy.value = null
  }
}
const modeOptions = computed<SegmentOption<'plain' | 'definition'>[]>(() => [
  { value: 'plain', label: t('releases.plain') },
  { value: 'definition', label: t('releases.definition') },
])
const canTouch = (env: EnvName) => env !== 'production' || session.canDeployProduction
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-start gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="m-0 text-[22px] font-extrabold tracking-tight">{{ release.name }}</h1>
        <div class="mt-1 text-base text-muted">
          {{ t('releases.releasedBy', { when: fmtDate(release.createdAt), who: release.createdBy }) }}
          · {{ t('releases.defVersions', { from: release.fromVersion, to: release.toVersion }) }}
        </div>
        <p v-if="release.note" class="m-0 mt-1.5 text-md text-fg-2">{{ release.note }}</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <PBadge
            v-for="d in release.deployments"
            :key="d.env"
            :tone="
              d.status === 'succeeded' && !liveOn.some((e) => e.env === d.env)
                ? 'neutral'
                : STATUS_TONE[d.status]
            "
            size="xs"
            dot
          >
            <component :is="ENV_META[d.env].icon" :size="11" />{{ t(`releases.env.${d.env}`) }} ·
            {{
              d.status === 'succeeded'
                ? t('releases.deployedOn', { when: fmtDate(d.at ?? null, 'MMM D') })
                : t(`releases.status.${d.status}`)
            }}
          </PBadge>
          <PBadge v-if="!release.deployments.length" size="xs">{{ t('releases.notDeployed') }}</PBadge>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <PButton
          v-for="e in promote"
          :key="`p-${e.env}`"
          :variant="e.env === 'production' ? 'primary' : 'outline'"
          :icon="canTouch(e.env) ? Rocket : UserCheck"
          :loading="busy === `deploy:${e.env}`"
          @click="deploy(e.env)"
        >
          {{
            canTouch(e.env)
              ? t('releases.deployTo', { env: t(`releases.env.${e.env}`) })
              : t('releases.requestApprovalFor', { env: t(`releases.env.${e.env}`) })
          }}
        </PButton>
        <PButton
          v-for="e in rollbackTo"
          :key="`r-${e.env}`"
          variant="danger"
          :icon="RotateCcw"
          :disabled="!canTouch(e.env)"
          :title="canTouch(e.env) ? undefined : t('releases.rollbackAdmins')"
          @click="confirm = e"
        >
          {{ t('releases.rollbackEnv', { env: t(`releases.env.${e.env}`) }) }}
        </PButton>
      </div>
    </div>

    <div v-if="liveOn.length" class="mb-4 text-sm text-muted">
      {{ t('releases.liveOnList', { envs: liveOn.map((e) => t(`releases.env.${e.env}`)).join(', ') }) }}
    </div>

    <div v-if="detail.isLoading.value" class="flex items-center gap-2 py-8 text-muted">
      <PSpinner :size="14" />{{ t('releases.loading') }}
    </div>
    <template v-else-if="detail.data.value">
      <template v-if="detail.data.value.migrations.length || detail.data.value.provisioning.length">
        <h2 class="eyebrow mb-2 mt-0">{{ t('releases.migrationsTitle') }}</h2>
        <MigrationList
          class="mb-5"
          :migrations="detail.data.value.migrations"
          :provisioning="detail.data.value.provisioning"
        />
      </template>
      <div class="mb-2 flex items-center gap-3">
        <h2 class="eyebrow m-0 flex-1">
          {{ previous ? t('releases.changesSince', { name: previous.name }) : t('releases.changesTitle') }}
        </h2>
        <PSegmented v-model="mode" :options="modeOptions" :aria-label="t('releases.viewAs')" />
      </div>
      <ChangeList
        v-if="detail.data.value.changes.length"
        :changes="detail.data.value.changes"
        :mode="mode"
        :project-id="projectId"
      />
      <PEmptyState v-else :icon="History" :title="t('releases.noChangeDetail')" />
    </template>

    <PDialog
      v-model:open="confirmOpen"
      :description="t('releases.rollbackDesc')"
      :title="
        t('releases.rollbackTitle', {
          env: confirm ? t(`releases.env.${confirm.env}`) : '',
          name: release.name,
        })
      "
      :icon="RotateCcw"
      :width="480"
    >
      <p class="m-0 text-base leading-relaxed text-fg-2">
        {{
          t('releases.rollbackBody', {
            env: confirm ? t(`releases.env.${confirm.env}`) : '',
            from: confirm?.releaseName ?? '',
            name: release.name,
          })
        }}
      </p>
      <p class="m-0 mt-2 text-base leading-relaxed text-fg-2">
        {{ t('releases.rollbackRecords', { env: confirm ? t(`releases.env.${confirm.env}`) : '' }) }}
      </p>
      <template #footer="{ close }">
        <PButton @click="close">{{ t('releases.cancel') }}</PButton>
        <PButton
          variant="danger-solid"
          :icon="RotateCcw"
          :loading="!!busy?.startsWith('rollback')"
          @click="rollback"
        >
          {{ t('releases.rollbackEnv', { env: confirm ? t(`releases.env.${confirm.env}`) : '' }) }}
        </PButton>
      </template>
    </PDialog>
  </div>
</template>
