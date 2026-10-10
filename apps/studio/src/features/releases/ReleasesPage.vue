<script setup lang="ts">
/**
 * Releases & environments (requirements §3.7): unreleased changes by area, versions with their diff,
 * environment status, prepare → validate → migrate → provision → deploy, Production approval, rollback.
 */
import { computed, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CircleAlert, Inbox, Rocket, ShieldCheck } from 'lucide-vue-next'
import type { EnvironmentState, EnvName, Problem, Release } from '@platon/definition'
import {
  PBadge,
  PButton,
  PDialog,
  PEmptyState,
  PSegmented,
  PSpinner,
  PTooltip,
  toast,
  type SegmentOption,
  type Tone,
} from '@platon/ui'
import LayerShell from '@/components/shell/LayerShell.vue'
import PanelHeader from '@/components/shell/PanelHeader.vue'
import ProblemsList from '@/components/common/ProblemsList.vue'
import SectionLabel from '@/components/common/SectionLabel.vue'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'
import { fmtDate } from '@/composables/format'
import { errorMessage } from '@/services/http'
import { linkForPointer } from '@/composables/definitionLinks'
import { useReleaseCommands, useReleases } from './api'
import { ENV_META, STATUS_TONE } from './envs'
import EnvCards from './components/EnvCards.vue'
import ChangeList from './components/ChangeList.vue'
import ReleaseDetail from './components/ReleaseDetail.vue'
import PrepareReleaseDialog from './components/PrepareReleaseDialog.vue'
import DeployProgress from './components/DeployProgress.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const def = useDefinitionStore()
const projectId = useProjectId()
const releases = useReleases(projectId)
const cmd = useReleaseCommands(projectId)

const items = computed(() => releases.data.value?.items ?? [])
const envs = computed<EnvironmentState[]>(() => releases.data.value?.environments ?? [])
const selectedId = computed(() => (typeof route.query.v === 'string' ? route.query.v : 'draft'))
const selected = computed(() => items.value.find((r) => r.id === selectedId.value) ?? null)
const isDraft = computed(() => !selected.value)
function pick(id: string) {
  void router.replace({ query: { ...route.query, v: id === 'draft' ? undefined : id } })
}

const mode = ref<'plain' | 'definition'>('plain')
const modeOptions = computed<SegmentOption<'plain' | 'definition'>[]>(() => [
  { value: 'plain', label: t('releases.plain') },
  { value: 'definition', label: t('releases.definition') },
])

const errors = computed(() => def.problems.filter((p) => p.severity === 'error'))
const pending = computed(() => def.changes)
const blockReason = computed(() =>
  errors.value.length
    ? t('releases.blockedTip', { n: errors.value.length }, errors.value.length)
    : !pending.value.length
      ? t('releases.nothingTip')
      : '',
)

/** Badge in the versions list: most promoted env it runs in, else what is happening to it. */
function badge(r: Release): { tone: Tone; label: string; icon?: Component } {
  const live = envs.value.filter((e) => e.releaseId === r.id).at(-1)
  if (live)
    return {
      tone: ENV_META[live.env].tone,
      label: t(`releases.env.${live.env}`),
      icon: ENV_META[live.env].icon,
    }
  const d = r.deployments.find(
    (x) => x.status === 'running' || x.status === 'awaiting_approval' || x.status === 'failed',
  )
  if (d) return { tone: STATUS_TONE[d.status], label: t(`releases.status.${d.status}`) }
  return { tone: 'neutral', label: t('releases.archived') }
}

function openProblem(p: Problem) {
  const tg = linkForPointer(projectId.value, p.path, def.definition)
  if (tg) void router.push(tg.to)
}

// ---- dialogs -------------------------------------------------------------------------------
const prepareOpen = ref(false)
const prepareTarget = ref<EnvName>('staging')
function openPrepare(target: EnvName = 'staging') {
  prepareTarget.value = target
  prepareOpen.value = true
}

const jobId = ref<string | null>(null)
const jobOpen = computed({ get: () => !!jobId.value, set: (v) => (v ? null : (jobId.value = null)) })
async function approve(e: EnvironmentState) {
  if (!e.pending) return
  try {
    const job = await cmd.deploy(e.pending.releaseId, e.env)
    jobId.value = job.id
  } catch (err) {
    toast(errorMessage(err), { tone: 'danger' })
  }
}
</script>

<template>
  <LayerShell :has-right="false">
    <template #left>
      <PanelHeader :title="t('releases.title')" :sub="t('releases.sub')" />
      <SectionLabel :label="t('releases.versions')" :count="items.length" />
      <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 pb-12 scroll-thin">
        <button
          type="button"
          class="rounded-lg px-2.5 py-2 text-left"
          :class="isDraft ? 'bg-primary-tint' : 'hover:bg-hover'"
          :aria-current="isDraft ? 'true' : undefined"
          @click="pick('draft')"
        >
          <div class="flex items-center gap-2">
            <span class="text-md font-bold">{{ t('releases.unreleased') }}</span>
            <PBadge class="ml-auto" size="xs" tone="primary">{{ t('releases.draft') }}</PBadge>
          </div>
          <div class="mt-0.5 text-xs text-faint">
            {{ t('releases.changesInDev', { n: pending.length }, pending.length) }}
          </div>
        </button>
        <div v-if="releases.isLoading.value" class="flex justify-center py-4 text-muted">
          <PSpinner :size="14" />
        </div>
        <button
          v-for="r in items"
          :key="r.id"
          type="button"
          class="rounded-lg px-2.5 py-2 text-left"
          :class="selectedId === r.id ? 'bg-primary-tint' : 'hover:bg-hover'"
          :aria-current="selectedId === r.id ? 'true' : undefined"
          @click="pick(r.id)"
        >
          <div class="flex items-center gap-2">
            <span class="text-md font-bold">{{ r.name }}</span>
            <PBadge class="ml-auto" size="xs" :tone="badge(r).tone">
              <component :is="badge(r).icon" v-if="badge(r).icon" :size="10" />{{ badge(r).label }}
            </PBadge>
          </div>
          <div class="mt-0.5 truncate text-xs text-faint">
            {{ fmtDate(r.createdAt, 'MMM D') }} · {{ r.createdBy
            }}<template v-if="r.note"> · {{ r.note }}</template>
          </div>
        </button>
      </div>
    </template>

    <div class="min-h-0 flex-1 overflow-auto px-7 pb-12 pt-6 scroll-thin">
      <div class="mx-auto max-w-[1100px]">
        <EnvCards
          v-if="envs.length"
          :environments="envs"
          :unreleased="pending.length"
          @approve="approve"
          @open-job="jobId = $event"
        />
        <div v-else-if="releases.isLoading.value" class="h-[104px] animate-pulse rounded-xl bg-subtle" />

        <div class="mb-6 mt-2.5 flex items-center gap-2 rounded-lg px-1 text-sm text-muted">
          <ShieldCheck :size="14" class="shrink-0 text-purple" />
          <span>{{ t('releases.structureShips') }}</span>
        </div>

        <!-- unreleased changes -->
        <template v-if="isDraft">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <div class="min-w-0 flex-1">
              <h1 class="m-0 text-[22px] font-extrabold tracking-tight">{{ t('releases.unreleased') }}</h1>
              <div class="mt-1 text-base text-muted">{{ t('releases.unreleasedSub') }}</div>
            </div>
            <PSegmented v-model="mode" :options="modeOptions" :aria-label="t('releases.viewAs')" />
            <PTooltip :text="blockReason" :disabled="!blockReason">
              <span>
                <PButton
                  variant="primary"
                  size="md"
                  :icon="Rocket"
                  :disabled="!!blockReason"
                  @click="openPrepare()"
                  >{{ t('releases.prepare') }}</PButton
                >
              </span>
            </PTooltip>
          </div>

          <div
            v-if="errors.length"
            class="mb-4 overflow-hidden rounded-xl border border-danger/30 bg-danger-bg"
            role="alert"
          >
            <div class="flex items-center gap-2 px-4 pt-3 font-bold text-danger">
              <CircleAlert :size="16" />{{ t('releases.blockedTitle', { n: errors.length }, errors.length) }}
            </div>
            <p class="m-0 px-4 pb-1 pt-0.5 text-sm text-danger/90">{{ t('releases.blockedSub') }}</p>
            <div class="mx-2 mb-2 rounded-lg bg-surface">
              <ProblemsList :problems="errors.slice(0, 6)" show-path @select="openProblem" />
            </div>
          </div>

          <ChangeList v-if="pending.length" :changes="pending" :mode="mode" :project-id="projectId" />
          <div v-else class="rounded-xl border border-dashed border-line bg-surface">
            <PEmptyState
              :icon="Inbox"
              :title="t('releases.emptyTitle')"
              :description="t('releases.emptySub')"
            />
          </div>
        </template>

        <!-- a released version -->
        <template v-else-if="selected">
          <ReleaseDetail
            :key="selected.id"
            :project-id="projectId"
            :release="selected"
            :releases="items"
            :environments="envs"
            v-model:mode="mode"
            @open-job="jobId = $event"
          />
        </template>
      </div>
    </div>

    <PrepareReleaseDialog
      v-model:open="prepareOpen"
      :project-id="projectId"
      :initial-target="prepareTarget"
      @released="pick"
    />

    <PDialog
      v-model:open="jobOpen"
      :title="t('releases.deploymentTitle')"
      :description="t('releases.deploymentDesc')"
      :icon="Rocket"
      :width="520"
    >
      <DeployProgress v-if="jobId" :project-id="projectId" :job-id="jobId" @finished="cmd.invalidate()" />
      <template #footer="{ close }">
        <PButton @click="close">{{ t('releases.done') }}</PButton>
      </template>
    </PDialog>
  </LayerShell>
</template>
