<script setup lang="ts">
/** Git: connect a repository, export folder, auto-commit on release, pull requests for Studio changes. */
import { computed, reactive, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Github,
  Gitlab,
  ShieldCheck,
  Unplug,
} from 'lucide-vue-next'
import { PButton, PCheckbox, PField, PInput, PSpinner, cn } from '@platon/ui'
import type { GitProvider, GitResponse, UpdateGitRequest } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'
import { relTime } from '@/composables/format'
import { http } from '@/services/http'
import SettingsCard from '../components/SettingsCard.vue'
import ToggleRow from '../components/ToggleRow.vue'
import { settingsKeys, useGit, useResourceMutation } from '../api'

const { t } = useI18n()
const def = useDefinitionStore()
const pid = useProjectId()
const git = useGit(pid)

const PROVIDERS: { id: GitProvider; label: string; icon: Component }[] = [
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'gitlab', label: 'GitLab', icon: Gitlab },
  { id: 'bitbucket', label: 'Bitbucket', icon: GitBranch },
]
const providerOf = (id: GitProvider) => PROVIDERS.find((p) => p.id === id)!

const form = reactive<
  Required<Pick<UpdateGitRequest, 'provider' | 'repo' | 'branch' | 'path' | 'autoCommit' | 'openPr'>>
>({ provider: 'github', repo: '', branch: 'main', path: '/platon', autoCommit: true, openPr: true })
watch(
  () => git.data.value?.config,
  (c) =>
    c &&
    Object.assign(form, {
      provider: c.provider,
      repo: c.repo,
      branch: c.branch,
      path: c.path,
      autoCommit: c.autoCommit,
      openPr: c.openPr,
    }),
  { immediate: true },
)

const key = () => settingsKeys.git(pid.value)
const connect = useResourceMutation(
  key,
  async () => (await http.post<GitResponse>(`/projects/${pid.value}/git/connect`, { ...form })).data,
  {
    success: () => t('settings.git.connected', { repo: form.repo }),
  },
)
const disconnect = useResourceMutation(
  key,
  async () => (await http.post<GitResponse>(`/projects/${pid.value}/git/disconnect`)).data,
  { success: () => t('settings.git.disconnected') },
)
const patch = useResourceMutation(
  key,
  async (b: UpdateGitRequest) => (await http.patch<GitResponse>(`/projects/${pid.value}/git`, b)).data,
)
const push = useResourceMutation(
  key,
  async () => (await http.post<GitResponse>(`/projects/${pid.value}/git/push`)).data,
  {
    success: (r) =>
      r.config.openPr
        ? t('settings.git.prOpened', { provider: providerOf(r.config.provider).label })
        : t('settings.git.pushed'),
  },
)

const pending = computed(() => def.changes.filter((c) => !c.releaseId).length)
const autoCommit = computed({
  get: () => !!git.data.value?.config.autoCommit,
  set: (v: boolean) => patch.mutate({ autoCommit: v }),
})
const openPr = computed({
  get: () => !!git.data.value?.config.openPr,
  set: (v: boolean) => patch.mutate({ openPr: v }),
})

const tree = computed(() => {
  const d = def.definition!
  const path = (git.data.value?.config.path ?? form.path).replace(/^\/|\/$/g, '') || '.'
  return [
    { pre: '', name: `${path}/`, tone: 'text-fg' },
    { pre: '├─', name: 'app.yaml', tone: 'text-primary-strong' },
    { pre: '├─', name: `pages/  (${d.interface.pages.length} files)`, tone: 'text-primary-strong' },
    { pre: '├─', name: `tables/  (${d.data.tables.length} files)`, tone: 'text-primary-strong' },
    {
      pre: '├─',
      name: `logic/  (${d.logic.functions.length + d.logic.apis.length + d.logic.crons.length + d.logic.queues.length} files)`,
      tone: 'text-primary-strong',
    },
    ...d.workflows.map((w) => ({ pre: '├─', name: `workflows/${w.id}.yaml`, tone: 'text-primary-strong' })),
    { pre: '├─', name: 'access/roles.yaml', tone: 'text-primary-strong' },
    {
      pre: '├─',
      name: `translations/${d.settings.languages.map((l) => `${l}.yaml`).join(', ')}`,
      tone: 'text-primary-strong',
    },
    { pre: '├─', name: 'storage.yaml  (no keys)', tone: 'text-primary-strong' },
    { pre: '└─', name: 'Agent.md', tone: 'text-warn' },
  ]
})
</script>

<template>
  <div v-if="git.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <template v-else-if="git.data.value">
    <!-- Not connected -->
    <SettingsCard v-if="!git.data.value.config.connected" body-class="flex flex-col gap-4 p-5">
      <div>
        <div class="mb-2 text-sm font-semibold text-fg-2">{{ t('settings.git.provider') }}</div>
        <div
          class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2"
          role="radiogroup"
          :aria-label="t('settings.git.provider')"
        >
          <button
            v-for="p in PROVIDERS"
            :key="p.id"
            type="button"
            role="radio"
            :aria-checked="form.provider === p.id"
            :class="
              cn(
                'flex items-center gap-2.5 rounded-[11px] border-[1.5px] p-3 text-left',
                form.provider === p.id
                  ? 'border-primary bg-primary-tint'
                  : 'border-line-2 bg-surface hover:bg-hover',
              )
            "
            @click="form.provider = p.id"
          >
            <component :is="p.icon" :size="18" /><span class="text-md font-semibold">{{ p.label }}</span>
          </button>
        </div>
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <PField v-slot="{ id }" :label="t('settings.git.repo')" :hint="t('settings.git.repoHint')">
          <PInput :id="id" v-model="form.repo" mono size="lg" placeholder="owner/name" />
        </PField>
        <PField v-slot="{ id }" :label="t('settings.git.branch')">
          <PInput :id="id" v-model="form.branch" mono size="lg" />
        </PField>
        <PField v-slot="{ id }" :label="t('settings.git.path')" :hint="t('settings.git.pathHint')">
          <PInput :id="id" v-model="form.path" mono size="lg" />
        </PField>
      </div>
      <div class="flex flex-col gap-2">
        <PCheckbox
          :model-value="form.autoCommit"
          :label="t('settings.git.autoCommit')"
          @update:model-value="(v) => (form.autoCommit = v === true)"
        />
        <PCheckbox
          :model-value="form.openPr"
          :label="t('settings.git.openPr')"
          @update:model-value="(v) => (form.openPr = v === true)"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <PButton
          variant="ink"
          size="lg"
          :icon="providerOf(form.provider).icon"
          :loading="connect.isPending.value"
          :disabled="!form.repo.trim()"
          @click="connect.mutate(undefined)"
        >
          {{ t('settings.git.connect', { provider: providerOf(form.provider).label }) }}
        </PButton>
        <span class="text-sm text-muted">{{
          t('settings.git.authorize', { provider: providerOf(form.provider).label })
        }}</span>
      </div>
    </SettingsCard>

    <!-- Connected -->
    <template v-else>
      <SettingsCard body-class="flex flex-wrap items-center gap-3.5 px-5 py-[18px]">
        <div class="grid size-10 place-items-center rounded-[10px] bg-ink text-on-ink">
          <component :is="providerOf(git.data.value.config.provider).icon" :size="19" />
        </div>
        <div class="min-w-[220px] flex-1">
          <div class="font-mono text-xl font-bold">{{ git.data.value.config.repo }}</div>
          <div class="mt-0.5 text-sm text-muted">
            {{
              t('settings.git.sub', {
                provider: providerOf(git.data.value.config.provider).label,
                branch: git.data.value.config.branch,
                path: git.data.value.config.path,
                sync: relTime(git.data.value.config.lastSyncAt),
              })
            }}
          </div>
        </div>
        <PButton
          variant="primary"
          :icon="GitPullRequest"
          :disabled="!pending"
          :loading="push.isPending.value"
          @click="push.mutate(undefined)"
        >
          {{
            pending
              ? git.data.value.config.openPr
                ? t('settings.git.openPrN', { n: pending })
                : t('settings.git.pushN', { n: pending })
              : t('settings.git.upToDate')
          }}
        </PButton>
        <PButton :icon="Unplug" :loading="disconnect.isPending.value" @click="disconnect.mutate(undefined)">{{
          t('settings.git.disconnect')
        }}</PButton>
      </SettingsCard>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        <SettingsCard>
          <ToggleRow
            v-model="autoCommit"
            :label="t('settings.git.autoCommit')"
            :description="t('settings.git.autoCommitDesc')"
          />
          <ToggleRow
            v-model="openPr"
            :label="t('settings.git.openPr')"
            :description="t('settings.git.openPrDesc')"
          />
          <div class="px-[18px] py-3.5">
            <div class="mb-2 text-sm font-semibold text-fg-2">{{ t('settings.git.whatGoes') }}</div>
            <div
              class="rounded-[9px] border border-line-faint bg-bg-home px-3 py-2.5 font-mono text-xs leading-[1.75]"
            >
              <div v-for="(f, i) in tree" :key="i" class="flex gap-2">
                <span class="text-faint-2">{{ f.pre }}</span
                ><span :class="f.tone">{{ f.name }}</span>
              </div>
            </div>
            <div class="mt-2.5 flex gap-1.5 text-xs leading-snug text-muted">
              <ShieldCheck :size="13" class="mt-0.5 shrink-0 text-teal" />{{
                t('settings.git.neverCommitted')
              }}
            </div>
          </div>
        </SettingsCard>
        <SettingsCard :title="t('settings.git.recent')">
          <div
            v-for="c in git.data.value.commits"
            :key="c.hash"
            class="flex items-center gap-3 border-b border-line-faint px-[18px] py-[11px] last:border-b-0"
          >
            <GitCommitHorizontal :size="15" class="shrink-0 text-faint-2" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-base font-semibold">{{ c.message }}</div>
              <div class="text-xs text-faint">{{ c.by }} · {{ relTime(c.at) }}</div>
            </div>
            <span class="rounded-[5px] bg-subtle px-1.5 py-0.5 font-mono text-xs text-muted">{{
              c.hash
            }}</span>
          </div>
          <div v-if="!git.data.value.commits.length" class="p-6 text-center text-base text-faint">
            {{ t('settings.git.noCommits') }}
          </div>
        </SettingsCard>
      </div>
    </template>
  </template>
</template>
