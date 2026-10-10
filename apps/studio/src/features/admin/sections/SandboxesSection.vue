<script setup lang="ts">
/**
 * Sandboxes: the frontend (Vue 3 · Vite) and backend (NestJS · Platon Runtime) environments every project
 * runs in. Config is edited as a local draft and saved together (sticky bar); version updates, rollbacks and
 * per-project rebuilds act immediately. Secrets (env, git token) are write-only.
 */
import { computed, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowRight,
  CircleArrowUp,
  CircleCheck,
  CircleX,
  Container,
  Eye,
  FileArchive,
  GitBranch,
  Hammer,
  Lock,
  LockOpen,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import {
  PBadge,
  PButton,
  PField,
  PIcon,
  PInput,
  PSegmented,
  PSelect,
  PSpinner,
  PSwitch,
  PTextarea,
  cn,
  toast,
  type SegmentOption,
  type SelectOption,
} from '@platon/ui'
import type {
  Sandbox,
  SandboxConfig,
  SandboxId,
  SandboxRollout,
  SandboxSource,
  SandboxTestResult,
  UpdateSandboxRequest,
} from '@platon/definition'
import { fmtBytes, fmtDate, relTime } from '@/composables/format'
import { errorMessage, http } from '@/services/http'
import AdminCard from '../components/AdminCard.vue'
import SecretField from '../components/SecretField.vue'
import { adminKeys, useAdminMutation, useSandboxes } from '../api'

const { t } = useI18n()
const sandboxes = useSandboxes()
const sel = ref<SandboxId>('frontend')
const sb = computed(() => sandboxes.data.value?.find((s) => s.id === sel.value))

// ── Draft ────────────────────────────────────────────────────────────────────────────
type Draft = UpdateSandboxRequest
// JSON copy: query data is a reactive proxy, which structuredClone can't copy.
const pick = (s: Sandbox): Draft =>
  JSON.parse(
    JSON.stringify({
      source: s.source,
      git: s.git,
      template: s.template,
      image: s.image,
      archive: s.archive,
      run: s.run,
      resources: s.resources,
      network: s.network,
      env: s.env,
      ai: s.ai,
    }),
  ) as Draft
const draft = ref<Draft | null>(null)
let baseline = ''
let draftFor: SandboxId | null = null
// Reset the draft when switching sandbox or when the server copy changes and there are no local edits.
watch(
  sb,
  (s) => {
    const untouched = draft.value && JSON.stringify(draft.value) === baseline
    if (!s) draft.value = null
    else if (draftFor !== s.id || !draft.value || untouched) draft.value = pick(s)
    draftFor = s?.id ?? null
    baseline = s ? JSON.stringify(pick(s)) : ''
  },
  { immediate: true },
)
const dirty = computed(
  () => !!sb.value && !!draft.value && JSON.stringify(draft.value) !== JSON.stringify(pick(sb.value)),
)
const allowText = computed({
  get: () => draft.value?.network.allow.join('\n') ?? '',
  set: (v: string) =>
    draft.value &&
    (draft.value.network.allow = v
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)),
})

const replaceIn = (s: Sandbox) => (sandboxes.data.value ?? []).map((x) => (x.id === s.id ? s : x))
const save = useAdminMutation(
  async (v: { id: SandboxId; body: Draft }) =>
    (await http.put<Sandbox>(`/admin/sandboxes/${v.id}`, v.body)).data,
  {
    key: adminKeys.sandboxes,
    set: replaceIn,
    success: (s) => t('admin.sbx.saved', { name: s.name }),
  },
)
const apply = useAdminMutation(
  async (v: { id: SandboxId; rollout: SandboxRollout }) =>
    (await http.post<Sandbox>(`/admin/sandboxes/${v.id}/update`, { rollout: v.rollout })).data,
  {
    key: adminKeys.sandboxes,
    set: replaceIn,
    success: (s) => t('admin.sbx.updated', { name: s.name, v: s.version }),
  },
)
const rollback = useAdminMutation(
  async (v: { id: SandboxId; version: string }) =>
    (await http.post<Sandbox>(`/admin/sandboxes/${v.id}/rollback`, { version: v.version })).data,
  {
    key: adminKeys.sandboxes,
    set: replaceIn,
    success: (s) => t('admin.sbx.rolledBack', { name: s.name, v: s.version }),
  },
)
const rebuildProject = useAdminMutation(
  async (v: { id: SandboxId; pid: string; name: string }) =>
    (await http.post<Sandbox>(`/admin/sandboxes/${v.id}/projects/${v.pid}/update`)).data,
  {
    key: adminKeys.sandboxes,
    set: replaceIn,
    success: (s, v) => t('admin.sbx.rebuilding', { name: v.name, v: s.version }),
  },
)
const restart = useAdminMutation(
  async (id: SandboxId) => (await http.post<Sandbox>(`/admin/sandboxes/${id}/restart`)).data,
  {
    key: adminKeys.sandboxes,
    set: replaceIn,
    success: (s) => t('admin.sbx.restarting', { kind: s.id }),
  },
)

function discard() {
  if (sb.value) draft.value = pick(sb.value)
  newGitToken.value = null
  testResult.value = null
}

// ── Update ───────────────────────────────────────────────────────────────────────────
const reviewing = ref(false)
const rollout = ref<SandboxRollout>('new')
watch(sel, () => {
  reviewing.value = false
  testResult.value = null
})

// ── Source ───────────────────────────────────────────────────────────────────────────
const SOURCES: { id: SandboxSource; icon: Component }[] = [
  { id: 'git', icon: GitBranch },
  { id: 'template', icon: Package },
  { id: 'image', icon: Container },
  { id: 'archive', icon: FileArchive },
]
const srcText = (s: Sandbox) =>
  s.source === 'git'
    ? `${s.git.url.replace(/^https?:\/\//, '') || t('admin.sbx.noRepo')} @ ${s.git.ref}`
    : s.source === 'template'
      ? `platon/${s.id}-template · ${s.template.channel.toUpperCase()}`
      : s.source === 'image'
        ? s.image.ref
        : s.archive.file || t('admin.sbx.noArchive')

const refTypeOptions = computed<SelectOption<'tag' | 'branch' | 'commit'>[]>(() =>
  (['tag', 'branch', 'commit'] as const).map((x) => ({ value: x, label: t(`admin.sbx.refTypes.${x}`) })),
)
const authOptions = computed<SelectOption<'public' | 'token' | 'ssh'>[]>(() =>
  (['public', 'token', 'ssh'] as const).map((x) => ({ value: x, label: t(`admin.sbx.auths.${x}`) })),
)
const channelOptions = computed<SegmentOption<'stable' | 'lts' | 'beta'>[]>(() =>
  (['stable', 'lts', 'beta'] as const).map((x) => ({ value: x, label: t(`admin.sbx.channels.${x}`) })),
)
const versionOptions = computed<SelectOption<string>[]>(() =>
  (sb.value?.templateVersions ?? []).map((v) => ({
    value: v,
    label: v === sb.value?.version ? `v${v} · ${t('admin.sbx.current')}` : `v${v}`,
  })),
)
const pmOptions: SelectOption<'npm' | 'pnpm' | 'yarn'>[] = (['npm', 'pnpm', 'yarn'] as const).map((x) => ({
  value: x,
  label: x,
}))
const opts = (list: string[]): SelectOption<string>[] => list.map((x) => ({ value: x, label: x }))
const netOptions = computed<SegmentOption<'open' | 'allowlist' | 'blocked'>[]>(() =>
  (['open', 'allowlist', 'blocked'] as const).map((x) => ({ value: x, label: t(`admin.sbx.net.${x}`) })),
)

const newGitToken = ref<string | null>(null)
function setGitToken(v: string) {
  if (!draft.value) return
  draft.value.gitToken = v
  newGitToken.value = v
  toast(t('admin.sbx.tokenStaged'))
}

const testing = ref(false)
const testResult = ref<SandboxTestResult | null>(null)
async function test() {
  if (!draft.value) return
  testing.value = true
  try {
    testResult.value = (
      await http.post<SandboxTestResult>(`/admin/sandboxes/${sel.value}/test`, draft.value)
    ).data
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    testing.value = false
  }
}
function fakeUpload() {
  if (!draft.value || !sb.value) return
  draft.value.archive = {
    file: `platon-${sel.value}-sandbox-${sb.value.version}.zip`,
    sizeBytes: sel.value === 'frontend' ? 18.4 * 1024 ** 2 : 9.7 * 1024 ** 2,
  }
  toast(t('admin.sbx.archiveChecked'))
}

const manifest = computed(() => {
  const d = draft.value
  if (!d || !sb.value) return ''
  const m: Record<string, unknown> = {
    kind: sel.value,
    run: { install: d.run.install, dev: d.run.dev, build: d.run.build, port: d.run.port },
    ...(sel.value === 'backend' ? { health: d.run.health } : {}),
    aiWritable: d.ai.writable,
  }
  if (sel.value === 'frontend') Object.assign(m, { components: 'src/components', pages: 'src/pages' })
  return JSON.stringify(m, null, 2)
})

// ── Env ──────────────────────────────────────────────────────────────────────────────
const revealNew = ref<Record<string, boolean>>({})
function addEnv() {
  draft.value?.env.push({ id: `e${Date.now().toString(36)}`, key: '', secret: false, value: '' })
}
function toggleSecret(i: number) {
  const e = draft.value!.env[i]!
  if (e.secret) {
    // Making a stored secret plain needs a new value; the old one is never revealed.
    draft.value!.env[i] = { id: e.id, key: e.key, secret: false, value: '' }
  } else {
    draft.value!.env[i] = { id: e.id, key: e.key, secret: true, value: e.value ?? '', set: false }
  }
}
const isNewSecret = (e: SandboxConfig['env'][number]) => e.secret && e.value !== undefined

function toggleFolder(f: string) {
  const ai = draft.value!.ai
  ai.writable = ai.writable.includes(f) ? ai.writable.filter((x) => x !== f) : [...ai.writable, f]
}
</script>

<template>
  <div v-if="sandboxes.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <template v-else-if="sb && draft">
    <!-- Cards -->
    <div
      class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3"
      role="radiogroup"
      :aria-label="t('admin.sbx.pick')"
    >
      <button
        v-for="s in sandboxes.data.value"
        :key="s.id"
        type="button"
        role="radio"
        :aria-checked="s.id === sel"
        :class="
          cn(
            'flex min-w-0 flex-col gap-3 rounded-[14px] border-[1.5px] bg-surface p-4 text-left',
            s.id === sel ? 'border-primary shadow-focus' : 'border-line-2 hover:border-line',
          )
        "
        @click="sel = s.id"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <div
            class="grid size-[38px] shrink-0 place-items-center rounded-[10px] bg-primary-tint text-primary"
          >
            <PIcon :name="s.id === 'frontend' ? 'monitor' : 'server'" :size="18" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[14.5px] font-bold">{{ s.name }}</div>
            <div class="truncate text-xs text-muted">{{ s.kind }}</div>
          </div>
          <PBadge :tone="s.running ? 'ok' : 'neutral'" dot>{{
            s.running ? t('admin.sbx.running') : t('admin.sbx.stopped')
          }}</PBadge>
        </div>
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="font-mono text-[20px] font-bold">v{{ s.version }}</span>
          <span class="font-mono text-xs text-faint">{{ s.commit }}</span>
          <PBadge v-if="s.latest" size="xs" tone="warn" :icon="CircleArrowUp" class="ml-auto">{{
            t('admin.sbx.available', { v: s.latest.version })
          }}</PBadge>
          <span v-else class="ml-auto flex items-center gap-1 text-xs font-semibold text-ok"
            ><CircleCheck :size="13" />{{ t('admin.sbx.upToDate') }}</span
          >
        </div>
        <div class="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <component :is="SOURCES.find((x) => x.id === s.source)!.icon" :size="13" class="shrink-0" />
          <span class="truncate font-mono">{{ srcText(s) }}</span>
        </div>
      </button>
    </div>

    <!-- Version -->
    <AdminCard body-class="flex flex-col gap-3.5 px-5 py-[18px]">
      <div class="flex flex-wrap items-start gap-2.5">
        <div>
          <h2 class="text-[15.5px] font-bold">{{ t('admin.sbx.version') }}</h2>
          <p class="mt-0.5 text-sm text-muted">{{ t('admin.sbx.versionDesc', { kind: sb.id }) }}</p>
        </div>
        <div class="ml-auto flex gap-1.5">
          <PButton
            size="sm"
            :icon="RotateCw"
            :loading="restart.isPending.value"
            @click="restart.mutate(sb.id)"
            >{{ t('admin.sbx.restartAll') }}</PButton
          >
          <PButton size="sm" :icon="Hammer" @click="toast(t('admin.sbx.rebuildingImage', { kind: sb.id }))">{{
            t('admin.sbx.rebuild')
          }}</PButton>
        </div>
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        <div class="flex flex-col gap-1">
          <div class="text-sm font-semibold text-muted">{{ t('admin.sbx.runningVersion') }}</div>
          <div class="font-mono text-[26px] font-bold tracking-[-0.01em]">v{{ sb.version }}</div>
          <div class="font-mono text-xs text-faint">commit {{ sb.commit }}</div>
          <div class="text-xs text-muted">
            {{ t('admin.sbx.applied', { when: fmtDate(sb.appliedAt, 'MMM D, YYYY'), who: sb.appliedBy }) }}
          </div>
        </div>
        <div class="overflow-hidden rounded-[10px] border border-line-faint">
          <div
            v-for="r in sb.stack"
            :key="r.name"
            class="flex items-center gap-2.5 border-b border-line-faint px-3 py-[7px] text-sm last:border-b-0"
          >
            <span class="flex-1">{{ r.name }}</span
            ><span class="font-mono text-xs text-fg-2">{{ r.version }}</span>
          </div>
        </div>
      </div>
      <div
        v-if="sb.latest"
        class="flex flex-col gap-3 rounded-xl border border-warn/30 bg-warn-bg/60 px-3.5 py-3"
      >
        <div class="flex flex-wrap items-center gap-2.5">
          <CircleArrowUp :size="16" class="text-warn" />
          <div class="min-w-[200px] flex-1">
            <div class="text-md font-bold text-warn">
              {{ t('admin.sbx.isAvailable', { v: sb.latest.version }) }}
            </div>
            <div class="mt-0.5 text-sm text-fg-2">{{ sb.latest.note }}</div>
          </div>
          <PButton size="sm" @click="reviewing = !reviewing">{{
            reviewing ? t('admin.sbx.hide') : t('admin.sbx.review')
          }}</PButton>
        </div>
        <template v-if="reviewing">
          <div class="overflow-hidden rounded-[10px] border border-line-2 bg-surface">
            <div
              v-for="d in sb.latest.diff"
              :key="d.name"
              class="flex items-center gap-2.5 border-b border-line-faint px-3 py-[7px] text-sm last:border-b-0"
            >
              <span class="flex-1">{{ d.name }}</span>
              <span class="font-mono text-xs text-faint line-through">{{ d.from }}</span>
              <ArrowRight :size="12" class="text-faint" />
              <span class="font-mono text-xs font-bold text-ok">{{ d.to }}</span>
            </div>
          </div>
          <div class="text-xs font-bold text-fg-2">{{ t('admin.sbx.rollTo') }}</div>
          <div
            class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2"
            role="radiogroup"
            :aria-label="t('admin.sbx.rollTo')"
          >
            <button
              v-for="r in ['new', 'all', 'choose'] as const"
              :key="r"
              type="button"
              role="radio"
              :aria-checked="rollout === r"
              :class="
                cn(
                  'flex items-start gap-2 rounded-[10px] border-[1.5px] p-2.5 text-left',
                  rollout === r ? 'border-primary bg-primary-tint/50' : 'border-line-2 bg-surface',
                )
              "
              @click="rollout = r"
            >
              <span
                :class="
                  cn(
                    'mt-0.5 size-3.5 shrink-0 rounded-full border-[1.5px]',
                    rollout === r ? 'border-[4px] border-primary' : 'border-line',
                  )
                "
              />
              <span>
                <span class="block text-base font-semibold">{{ t(`admin.sbx.rollouts.${r}`) }}</span>
                <span class="block text-xs text-muted">{{
                  t(`admin.sbx.rollouts.${r}Desc`, { v: sb.version })
                }}</span>
              </span>
            </button>
          </div>
          <div class="flex justify-end gap-1.5">
            <PButton size="sm" @click="reviewing = false">{{ t('admin.sbx.later') }}</PButton>
            <PButton
              size="sm"
              variant="primary"
              :loading="apply.isPending.value"
              @click="apply.mutate({ id: sb.id, rollout }, { onSuccess: () => (reviewing = false) })"
              >{{ t('admin.sbx.apply', { v: sb.latest.version }) }}</PButton
            >
          </div>
        </template>
      </div>
    </AdminCard>

    <!-- Source -->
    <AdminCard body-class="flex flex-col gap-3.5 px-5 py-[18px]">
      <div>
        <h2 class="text-[15.5px] font-bold">{{ t('admin.sbx.source') }}</h2>
        <p class="mt-0.5 text-sm text-muted">{{ t('admin.sbx.sourceDesc', { kind: sb.id }) }}</p>
      </div>
      <div
        class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2"
        role="radiogroup"
        :aria-label="t('admin.sbx.source')"
      >
        <button
          v-for="o in SOURCES"
          :key="o.id"
          type="button"
          role="radio"
          :aria-checked="draft.source === o.id"
          :class="
            cn(
              'flex items-start gap-2.5 rounded-xl border-[1.5px] p-3 text-left',
              draft.source === o.id
                ? 'border-primary bg-primary-tint/50'
                : 'border-line-2 bg-surface hover:bg-hover',
            )
          "
          @click="((draft.source = o.id), (testResult = null))"
        >
          <component
            :is="o.icon"
            :size="17"
            :class="cn('mt-px shrink-0', draft.source === o.id ? 'text-primary' : 'text-faint')"
          />
          <span>
            <span class="block text-base font-semibold">{{ t(`admin.sbx.sources.${o.id}`) }}</span>
            <span class="block text-xs leading-snug text-muted">{{
              t(`admin.sbx.sources.${o.id}Desc`)
            }}</span>
          </span>
        </button>
      </div>

      <template v-if="draft.source === 'git'">
        <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
          <PField
            v-slot="{ id }"
            :label="t('admin.sbx.repoUrl')"
            :hint="t('admin.sbx.repoUrlHint')"
            class="col-span-full"
          >
            <PInput :id="id" v-model="draft.git.url" mono />
          </PField>
          <PField :label="t('admin.sbx.pinTo')"
            ><PSelect
              v-model="draft.git.refType"
              :options="refTypeOptions"
              :aria-label="t('admin.sbx.pinTo')"
          /></PField>
          <PField
            v-slot="{ id }"
            :label="t(`admin.sbx.refTypes.${draft.git.refType}`)"
            :hint="draft.git.refType === 'branch' ? t('admin.sbx.branchHint') : undefined"
          >
            <PInput :id="id" v-model="draft.git.ref" mono />
          </PField>
          <PField v-slot="{ id }" :label="t('admin.sbx.subfolder')" :hint="t('admin.sbx.subfolderHint')"
            ><PInput :id="id" v-model="draft.git.path" mono
          /></PField>
          <PField :label="t('admin.sbx.auth')"
            ><PSelect v-model="draft.git.auth" :options="authOptions" :aria-label="t('admin.sbx.auth')"
          /></PField>
          <PField
            v-if="draft.git.auth === 'token'"
            :label="t('admin.sbx.token')"
            :hint="newGitToken ? t('admin.sbx.tokenPending') : t('admin.sbx.tokenHint')"
            class="col-span-full"
          >
            <SecretField
              :set="sb.git.tokenSet || !!newGitToken"
              :label="t('admin.sbx.token')"
              @save="setGitToken"
            />
          </PField>
          <PField
            v-if="draft.git.auth === 'ssh'"
            v-slot="{ id }"
            :label="t('admin.sbx.deployKey')"
            :hint="t('admin.sbx.deployKeyHint')"
            class="col-span-full"
          >
            <PInput :id="id" :model-value="sb.git.publicKey" mono readonly />
          </PField>
        </div>
        <div class="flex items-center gap-2.5">
          <PSwitch v-model="draft.git.autoSync" :label="t('admin.sbx.autoSync')" />
          <span class="text-base">{{ t('admin.sbx.autoSync') }}</span>
        </div>
        <div
          v-if="draft.git.autoSync"
          class="flex min-w-0 items-center gap-2 rounded-[10px] bg-subtle px-3 py-2"
        >
          <span class="shrink-0 text-xs font-semibold text-fg-2">{{ t('admin.sbx.webhook') }}</span>
          <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted"
            >https://studio.acme-facilities.com/hooks/sandbox/{{ sb.id }}</span
          >
        </div>
        <div class="flex flex-wrap items-center gap-2.5">
          <PButton size="sm" :loading="testing" @click="test">{{ t('admin.sbx.test') }}</PButton>
        </div>
        <div
          v-if="testResult"
          class="flex flex-col gap-1.5 rounded-[10px] border border-line-faint px-3 py-2.5"
        >
          <div
            v-for="(l, i) in testResult.lines"
            :key="i"
            :class="cn('flex items-center gap-2 text-sm', l.ok ? 'text-fg' : 'text-danger')"
          >
            <component
              :is="l.ok ? CircleCheck : CircleX"
              :size="14"
              :class="l.ok ? 'text-ok' : 'text-danger'"
            />{{ l.text }}
          </div>
        </div>
      </template>

      <template v-else-if="draft.source === 'template'">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm font-semibold text-fg-2">{{ t('admin.sbx.channel') }}</span>
          <PSegmented
            v-model="draft.template.channel"
            :options="channelOptions"
            :aria-label="t('admin.sbx.channel')"
          />
        </div>
        <p class="text-xs leading-snug text-muted">
          {{ t(`admin.sbx.channelNotes.${draft.template.channel}`) }}
        </p>
        <PField :label="t('admin.sbx.pinnedVersion')" :hint="t('admin.sbx.pinnedHint')" class="max-w-[320px]">
          <PSelect
            v-model="draft.template.version"
            :options="versionOptions"
            :aria-label="t('admin.sbx.pinnedVersion')"
          />
        </PField>
      </template>

      <template v-else-if="draft.source === 'image'">
        <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
          <PField v-slot="{ id }" :label="t('admin.sbx.image')" hint="registry/name:tag" class="col-span-full"
            ><PInput :id="id" v-model="draft.image.ref" mono
          /></PField>
          <PField :label="t('admin.sbx.pullSecret')">
            <PSelect
              v-model="draft.image.pullSecret"
              :options="[
                { value: 'acme-registry', label: 'acme-registry' },
                { value: 'none', label: t('admin.sbx.publicImage') },
              ]"
              :aria-label="t('admin.sbx.pullSecret')"
            />
          </PField>
          <PField :label="t('admin.sbx.pinDigest')">
            <div class="flex h-[34px] items-center gap-2">
              <PSwitch v-model="draft.image.pinDigest" :label="t('admin.sbx.pinDigest')" /><span
                class="text-sm text-muted"
                >{{ draft.image.pinDigest ? t('admin.sbx.digestYes') : t('admin.sbx.digestNo') }}</span
              >
            </div>
          </PField>
        </div>
      </template>

      <template v-else>
        <button
          type="button"
          class="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-line p-[22px] text-center hover:border-primary hover:bg-primary-tint/30"
          @click="fakeUpload"
        >
          <Upload :size="20" class="text-primary" />
          <span class="text-md font-semibold">{{ draft.archive.file || t('admin.sbx.drop') }}</span>
          <span class="text-xs text-muted">{{
            draft.archive.file
              ? t('admin.sbx.archiveSize', { size: fmtBytes(draft.archive.sizeBytes) })
              : t('admin.sbx.dropHint')
          }}</span>
        </button>
        <p class="text-xs leading-snug text-muted">{{ t('admin.sbx.archiveNote') }}</p>
      </template>

      <div
        class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-3 border-t border-line-faint pt-3"
      >
        <p class="text-sm leading-normal text-fg-2">
          <b>{{ t('admin.sbx.requiredTitle') }}</b> {{ t('admin.sbx.requiredBody1') }}
          <code class="rounded bg-subtle px-1 font-mono text-xs">platon.sandbox.json</code>
          {{ t('admin.sbx.requiredBody2') }}
        </p>
        <pre
          class="overflow-auto rounded-[10px] bg-code-bg px-3.5 py-2.5 font-mono text-xs leading-relaxed text-code-fg scroll-thin"
        ><span class="text-code-muted">// platon.sandbox.json</span>
{{ manifest }}</pre>
      </div>
    </AdminCard>

    <!-- Run & build -->
    <AdminCard
      :title="t('admin.sbx.run')"
      :description="t('admin.sbx.runDesc')"
      body-class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5 p-5"
    >
      <PField :label="t('admin.sbx.pm')"
        ><PSelect v-model="draft.run.pm" :options="pmOptions" :aria-label="t('admin.sbx.pm')"
      /></PField>
      <PField v-slot="{ id }" :label="t('admin.sbx.install')"
        ><PInput :id="id" v-model="draft.run.install" mono
      /></PField>
      <PField
        v-slot="{ id }"
        :label="sb.id === 'frontend' ? t('admin.sbx.devServer') : t('admin.sbx.startWatch')"
        ><PInput :id="id" v-model="draft.run.dev" mono
      /></PField>
      <PField v-slot="{ id }" :label="t('admin.sbx.build')"
        ><PInput :id="id" v-model="draft.run.build" mono
      /></PField>
      <PField v-slot="{ id }" :label="t('admin.sbx.port')"
        ><PInput
          :id="id"
          :model-value="draft.run.port"
          mono
          inputmode="numeric"
          @update:model-value="
            (v) => draft && (draft.run.port = Number(String(v ?? '').replace(/\D/g, '')) || 0)
          "
      /></PField>
      <PField v-slot="{ id }" :label="t('admin.sbx.health')" :hint="t('admin.sbx.healthHint')"
        ><PInput :id="id" v-model="draft.run.health" mono
      /></PField>
    </AdminCard>

    <!-- Resources -->
    <AdminCard
      :title="t('admin.sbx.resources')"
      :description="t('admin.sbx.resourcesDesc')"
      body-class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 p-5"
    >
      <PField :label="t('admin.sbx.cpu')"
        ><PSelect
          v-model="draft.resources.cpu"
          :options="opts(['0.5 vCPU', '1 vCPU', '2 vCPU', '4 vCPU'])"
          :aria-label="t('admin.sbx.cpu')"
      /></PField>
      <PField :label="t('admin.sbx.memory')"
        ><PSelect
          v-model="draft.resources.memory"
          :options="opts(['1 GB', '2 GB', '4 GB', '8 GB'])"
          :aria-label="t('admin.sbx.memory')"
      /></PField>
      <PField :label="t('admin.sbx.disk')"
        ><PSelect
          v-model="draft.resources.disk"
          :options="opts(['2 GB', '5 GB', '10 GB', '20 GB'])"
          :aria-label="t('admin.sbx.disk')"
      /></PField>
      <PField :label="t('admin.sbx.idle')"
        ><PSelect
          v-model="draft.resources.idle"
          :options="opts(['10 min', '30 min', '1 hour', 'Never'])"
          :aria-label="t('admin.sbx.idle')"
      /></PField>
      <PField v-slot="{ id }" :label="t('admin.sbx.max')" :hint="t('admin.sbx.maxHint')">
        <PInput
          :id="id"
          :model-value="draft.resources.maxRunning"
          mono
          inputmode="numeric"
          @update:model-value="
            (v) => draft && (draft.resources.maxRunning = Number(String(v ?? '').replace(/\D/g, '')) || 0)
          "
        />
      </PField>
    </AdminCard>

    <!-- Network -->
    <AdminCard
      :title="t('admin.sbx.network')"
      :description="t('admin.sbx.networkDesc')"
      body-class="flex flex-col gap-3.5 p-5"
    >
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm font-semibold text-fg-2">{{ t('admin.sbx.outbound') }}</span>
        <PSegmented
          v-model="draft.network.mode"
          :options="netOptions"
          :aria-label="t('admin.sbx.outbound')"
        />
      </div>
      <PField
        v-if="draft.network.mode === 'allowlist'"
        v-slot="{ id }"
        :label="t('admin.sbx.allowed')"
        :hint="t('admin.sbx.allowedHint')"
      >
        <PTextarea :id="id" v-model="allowText" mono :rows="4" />
      </PField>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        <PField v-slot="{ id }" :label="t('admin.sbx.registry')" :hint="t('admin.sbx.registryHint')"
          ><PInput :id="id" v-model="draft.network.registry" mono
        /></PField>
        <PField v-slot="{ id }" :label="t('admin.sbx.proxy')" :hint="t('admin.sbx.optional')"
          ><PInput :id="id" v-model="draft.network.proxy" mono
        /></PField>
      </div>
    </AdminCard>

    <!-- Env -->
    <AdminCard :title="t('admin.sbx.env')" :description="t('admin.sbx.envDesc', { kind: sb.id })">
      <template #actions
        ><PButton size="sm" :icon="Plus" @click="addEnv">{{ t('admin.sbx.addVar') }}</PButton></template
      >
      <div
        v-for="(e, i) in draft.env"
        :key="e.id"
        class="flex flex-wrap items-center gap-2 border-b border-line-faint px-[18px] py-2 last:border-b-0"
      >
        <PInput
          :model-value="e.key"
          mono
          size="sm"
          class="min-w-0 flex-[1_1_160px]"
          placeholder="NAME"
          :aria-label="t('admin.sbx.varName')"
          @update:model-value="
            (v) =>
              (e.key = String(v ?? '')
                .toUpperCase()
                .replace(/[^A-Z0-9_]/g, '_'))
          "
        />
        <div class="min-w-0 flex-[2_1_220px]">
          <SecretField
            v-if="e.secret && !isNewSecret(e)"
            :set="!!e.set"
            :label="e.key"
            @save="(v) => (e.value = v)"
          />
          <PInput
            v-else
            v-model="e.value"
            mono
            size="sm"
            :type="e.secret && !revealNew[e.id] ? 'password' : 'text'"
            autocomplete="new-password"
            placeholder="value"
            :aria-label="t('admin.sbx.varValue', { key: e.key })"
          />
        </div>
        <button
          type="button"
          :title="e.secret ? t('admin.sbx.secretTitle') : t('admin.sbx.plainTitle')"
          :class="
            cn(
              'flex h-[30px] items-center gap-1 rounded-[7px] border px-2 text-xs font-semibold',
              e.secret ? 'border-purple/30 bg-purple-bg text-purple' : 'border-line bg-surface text-faint',
            )
          "
          @click="toggleSecret(i)"
        >
          <component :is="e.secret ? Lock : LockOpen" :size="12" />{{
            e.secret ? t('admin.sbx.secret') : t('admin.sbx.plain')
          }}
        </button>
        <PButton
          square
          size="xs"
          variant="ghost"
          :icon="Trash2"
          :aria-label="t('admin.sbx.removeVar', { key: e.key })"
          @click="draft.env.splice(i, 1)"
        />
      </div>
      <div v-if="!draft.env.length" class="p-5 text-center text-base text-faint">
        {{ t('admin.sbx.noVars') }}
      </div>
    </AdminCard>

    <!-- AI access -->
    <AdminCard
      :title="t('admin.sbx.aiAccess')"
      :description="t('admin.sbx.aiAccessDesc')"
      body-class="flex flex-col gap-3.5 p-5"
    >
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="f in draft.ai.folders"
          :key="f"
          type="button"
          :aria-pressed="draft.ai.writable.includes(f)"
          :class="
            cn(
              'flex h-[30px] items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 font-mono text-xs',
              draft.ai.writable.includes(f)
                ? 'border-primary-ring bg-primary-tint/50 text-primary-strong'
                : 'border-line-2 bg-surface text-faint',
            )
          "
          @click="toggleFolder(f)"
        >
          <component :is="draft.ai.writable.includes(f) ? Pencil : Eye" :size="12" />{{ f }}
        </button>
      </div>
      <div class="flex items-center gap-2.5">
        <PSwitch v-model="draft.ai.review" :label="t('admin.sbx.review')" />
        <span class="text-base">{{ t('admin.sbx.reviewLabel') }}</span>
      </div>
    </AdminCard>

    <!-- Projects -->
    <AdminCard :title="t('admin.sbx.projects')" :description="t('admin.sbx.projectsDesc')">
      <div
        v-for="p in sb.projects"
        :key="p.projectId"
        class="flex items-center gap-3 border-b border-line-faint px-[18px] py-2.5 text-base last:border-b-0"
      >
        <span class="min-w-0 flex-1 truncate font-semibold">{{ p.name }}</span>
        <PBadge size="xs" :tone="p.running ? 'ok' : 'neutral'" dot>{{
          p.running ? t('admin.sbx.running') : t('admin.sbx.sleeping')
        }}</PBadge>
        <span class="w-[70px] font-mono text-xs">v{{ p.version }}</span>
        <span class="flex w-[130px] justify-end">
          <PButton
            v-if="p.version !== sb.version"
            size="xs"
            @click="rebuildProject.mutate({ id: sb.id, pid: p.projectId, name: p.name })"
            >{{ t('admin.sbx.updateTo', { v: sb.version }) }}</PButton
          >
          <span v-else class="flex items-center gap-1 text-xs font-semibold text-ok"
            ><CircleCheck :size="13" />{{ t('admin.sbx.current') }}</span
          >
        </span>
      </div>
    </AdminCard>

    <!-- History -->
    <AdminCard :title="t('admin.sbx.history')" :description="t('admin.sbx.historyDesc')">
      <div
        v-for="h in sb.history"
        :key="h.version + h.at"
        class="flex flex-wrap items-center gap-3 border-b border-line-faint px-[18px] py-2.5 text-base last:border-b-0"
      >
        <span class="w-16 font-mono font-bold">v{{ h.version }}</span>
        <span class="min-w-[160px] flex-1 text-fg-2">{{ h.note }}</span>
        <span class="text-xs text-faint">{{ relTime(h.at) }} · {{ h.by }}</span>
        <span class="flex w-[110px] justify-end">
          <PBadge v-if="h.version === sb.version" size="xs" tone="ok">{{ t('admin.sbx.current') }}</PBadge>
          <PButton
            v-else
            size="xs"
            :icon="RotateCcw"
            @click="rollback.mutate({ id: sb.id, version: h.version })"
            >{{ t('admin.sbx.rollBack') }}</PButton
          >
        </span>
      </div>
    </AdminCard>

    <div
      v-if="dirty"
      class="sticky bottom-3 z-10 flex flex-wrap items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-on-ink shadow-modal"
    >
      <span class="size-2 rounded-full bg-warn-dot" />
      <span class="min-w-[200px] flex-1 text-base">{{ t('admin.sbx.dirty', { kind: sb.id }) }}</span>
      <PButton size="sm" variant="ghost" class="text-on-ink hover:bg-ink-hover" @click="discard">{{
        t('admin.sbx.discard')
      }}</PButton>
      <PButton
        size="sm"
        variant="primary"
        :loading="save.isPending.value"
        @click="
          save.mutate(
            { id: sb.id, body: draft },
            { onSuccess: (r) => ((newGitToken = null), (draft = pick(r))) },
          )
        "
        >{{ t('admin.sbx.save') }}</PButton
      >
    </div>
  </template>
</template>
