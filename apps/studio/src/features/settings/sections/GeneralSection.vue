<script setup lang="ts">
/** General: name, address, description, default language, timezone, app theme and the danger zone. */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Archive, Copy, Moon, Sun, Monitor, Trash2, TriangleAlert } from 'lucide-vue-next'
import {
  PButton,
  PColorInput,
  PDialog,
  PField,
  PInput,
  PSegmented,
  PSelect,
  PTextarea,
  toast,
  type SegmentOption,
  type SelectOption,
} from '@platon/ui'
import { ENVIRONMENTS, type AppTheme, type EnvName, type ProjectSummary } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { useSessionStore } from '@/stores/session'
import { useProjectId } from '@/composables/useProject'
import { errorMessage, http } from '@/services/http'
import SettingsCard from '../components/SettingsCard.vue'
import { LANGUAGE_NAMES, TIMEZONES, languageLabel } from '../catalog'

const { t } = useI18n()
const router = useRouter()
const qc = useQueryClient()
const def = useDefinitionStore()
const session = useSessionStore()
const pid = useProjectId()

const project = useQuery({
  queryKey: computed(() => ['projects', pid.value]),
  queryFn: async () => (await http.get<ProjectSummary>(`/projects/${pid.value}`)).data,
})

const settings = computed(() => def.definition!.settings)
const name = ref('')
const slug = ref('')
const description = ref('')
watch(
  () => def.definition?.name,
  (v) => (name.value = v ?? ''),
  { immediate: true },
)
watch(
  () => settings.value.slug ?? project.data.value?.slug ?? pid.value,
  (v) => (slug.value = v),
  { immediate: true },
)
watch(
  () => project.data.value?.description,
  (v) => (description.value = v ?? ''),
  { immediate: true },
)

const patchProject = useMutation({
  mutationFn: async (body: Partial<ProjectSummary>) =>
    (await http.patch<ProjectSummary>(`/projects/${pid.value}`, body)).data,
  onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
})

const nameError = computed(() => (name.value.trim() ? null : t('settings.general.nameRequired')))
function saveName() {
  const v = name.value.trim()
  if (!v || v === def.definition!.name) return
  def.apply({
    key: 'app.name',
    area: 'Settings',
    text: `Renamed the app to “${v}”`,
    ops: [{ op: 'replace', path: '/name', value: v }],
  })
  patchProject.mutate({ name: v })
}

const SLUG_RE = /^[a-z][a-z0-9-]{1,40}[a-z0-9]$/
const slugError = computed(() => (SLUG_RE.test(slug.value) ? null : t('settings.general.slugInvalid')))
function saveSlug() {
  const v = slug.value.trim().toLowerCase()
  slug.value = v
  if (!SLUG_RE.test(v) || v === settings.value.slug) return
  def.apply({
    key: 'settings.slug',
    area: 'Settings',
    text: `Changed the app address to ${v}`,
    ops: [{ op: settings.value.slug ? 'replace' : 'add', path: '/settings/slug', value: v }],
  })
  patchProject.mutate({ slug: v })
}

function saveDescription() {
  if (description.value === (project.data.value?.description ?? '')) return
  patchProject.mutate(
    { description: description.value.trim() },
    { onSuccess: () => toast(t('settings.general.saved'), { tone: 'ok' }) },
  )
}

const previewEnv = ref<EnvName>('development')
const envOptions = computed<SegmentOption<EnvName>[]>(() =>
  ENVIRONMENTS.map((e) => ({ value: e.id, label: e.label })),
)
function addressFor(env: EnvName) {
  const short = env === 'development' ? 'dev' : env === 'staging' ? 'staging' : 'prod'
  return `https://${slug.value || 'app'}.${short}.platon.app`
}
function copyAddress() {
  void navigator.clipboard?.writeText(addressFor(previewEnv.value))
  toast(t('settings.general.copied'))
}

const langOptions = computed<SelectOption<string>[]>(() =>
  settings.value.languages.map((l) => ({ value: l, label: languageLabel(l) })),
)
const defaultLanguage = computed({
  get: () => settings.value.defaultLanguage,
  set: (v: string) =>
    def.apply({
      key: 'settings.defaultLanguage',
      area: 'Settings',
      text: `Default language set to ${LANGUAGE_NAMES[v] ?? v}`,
      ops: [{ op: 'replace', path: '/settings/defaultLanguage', value: v }],
    }),
})
const tzOptions = computed<SelectOption<string>[]>(() => {
  const list = TIMEZONES.includes(settings.value.timezone)
    ? TIMEZONES
    : [settings.value.timezone, ...TIMEZONES]
  return list.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))
})
const timezone = computed({
  get: () => settings.value.timezone,
  set: (v: string) =>
    def.apply({
      key: 'settings.timezone',
      area: 'Settings',
      text: `Time zone set to ${v}`,
      ops: [{ op: 'replace', path: '/settings/timezone', value: v }],
    }),
})

const theme = computed<AppTheme>(
  () => settings.value.theme ?? { color: '#4f5bea', mode: 'light', radius: 'soft' },
)
function setTheme(patch: Partial<AppTheme>, text: string) {
  const value = { ...theme.value, ...patch }
  def.apply({
    key: 'settings.theme',
    area: 'Settings',
    text,
    ops: [{ op: settings.value.theme ? 'replace' : 'add', path: '/settings/theme', value }],
  })
}
const color = computed({
  get: () => theme.value.color,
  set: (v: string) => setTheme({ color: v }, `Accent colour set to ${v}`),
})
const mode = computed({
  get: () => theme.value.mode,
  set: (v: AppTheme['mode']) => setTheme({ mode: v }, `App theme set to ${v}`),
})
const radius = computed({
  get: () => theme.value.radius,
  set: (v: AppTheme['radius']) => setTheme({ radius: v }, `Corner style set to ${v}`),
})
const modeOptions = computed<SegmentOption<AppTheme['mode']>[]>(() => [
  { value: 'light', label: t('settings.general.light'), icon: Sun },
  { value: 'dark', label: t('settings.general.dark'), icon: Moon },
  { value: 'system', label: t('settings.general.system'), icon: Monitor },
])
const radiusOptions = computed<SegmentOption<AppTheme['radius']>[]>(() => [
  { value: 'sharp', label: t('settings.general.sharp') },
  { value: 'soft', label: t('settings.general.soft') },
  { value: 'round', label: t('settings.general.round') },
])
const radiusPx = computed(() => ({ sharp: '3px', soft: '8px', round: '16px' })[theme.value.radius])

const canDanger = computed(() => session.canDeployProduction)

// ── Archive ──────────────────────────────────────────────────────────────────────────
const archiveOpen = ref(false)
const archive = useMutation({
  mutationFn: async () => http.patch(`/admin/projects/${pid.value}`, { archived: true }),
  onSuccess: () => {
    archiveOpen.value = false
    void qc.invalidateQueries({ queryKey: ['projects'] })
    void qc.invalidateQueries({ queryKey: ['admin'] })
    toast(t('settings.general.archived', { name: def.definition?.name }), { tone: 'ok' })
  },
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
})

// ── Delete ───────────────────────────────────────────────────────────────────────────
const deleteOpen = ref(false)
const confirmText = ref('')
const confirmTarget = computed(() => slug.value || pid.value)
const remove = useMutation({
  mutationFn: async () => http.delete(`/projects/${pid.value}`),
  onSuccess: async () => {
    const appName = def.definition?.name
    deleteOpen.value = false
    await qc.invalidateQueries({ queryKey: ['projects'] })
    def.reset()
    toast(t('settings.general.deleted', { name: appName }), { tone: 'ok' })
    await router.push({ name: 'home' })
  },
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
})
watch(deleteOpen, (o) => o && (confirmText.value = ''))
</script>

<template>
  <SettingsCard body-class="grid grid-cols-2 gap-4 p-5 max-[760px]:grid-cols-1">
    <PField v-slot="{ id }" :label="t('settings.general.name')" :error="nameError" required>
      <PInput
        :id="id"
        v-model="name"
        size="lg"
        :invalid="!!nameError"
        @blur="saveName"
        @keydown.enter="saveName"
      />
    </PField>
    <PField
      v-slot="{ id }"
      :label="t('settings.general.address')"
      :error="slugError"
      :hint="t('settings.general.addressHint')"
    >
      <PInput
        :id="id"
        v-model="slug"
        size="lg"
        mono
        :invalid="!!slugError"
        input-class="pr-[150px]"
        @blur="saveSlug"
        @keydown.enter="saveSlug"
      >
        <template #suffix
          ><span class="pr-1.5 font-mono text-sm text-faint"
            >.{{
              previewEnv === 'development' ? 'dev' : previewEnv === 'staging' ? 'staging' : 'prod'
            }}.platon.app</span
          ></template
        >
      </PInput>
    </PField>
    <div
      class="col-span-full flex flex-wrap items-center gap-3 rounded-[10px] border border-line-faint bg-subtle px-3 py-2.5"
    >
      <PSegmented
        v-model="previewEnv"
        :options="envOptions"
        :aria-label="t('settings.general.environment')"
      />
      <a
        :href="addressFor(previewEnv)"
        target="_blank"
        rel="noopener"
        class="min-w-0 flex-1 truncate font-mono text-sm text-primary-strong hover:underline"
        >{{ addressFor(previewEnv) }}</a
      >
      <PButton size="xs" variant="ghost" :icon="Copy" @click="copyAddress">{{
        t('settings.general.copy')
      }}</PButton>
    </div>
    <PField v-slot="{ id }" :label="t('settings.general.description')" class="col-span-full">
      <PTextarea :id="id" v-model="description" :rows="2" @blur="saveDescription" />
    </PField>
    <PField :label="t('settings.general.defaultLanguage')" :hint="t('settings.general.defaultLanguageHint')">
      <PSelect
        v-model="defaultLanguage"
        :options="langOptions"
        :aria-label="t('settings.general.defaultLanguage')"
      />
    </PField>
    <PField :label="t('settings.general.timezone')" :hint="t('settings.general.timezoneHint')">
      <PSelect v-model="timezone" :options="tzOptions" :aria-label="t('settings.general.timezone')" />
    </PField>
  </SettingsCard>

  <SettingsCard :title="t('settings.general.themeTitle')" :description="t('settings.general.themeDesc')">
    <div class="grid grid-cols-[minmax(0,1fr)_260px] gap-5 p-5 max-[860px]:grid-cols-1">
      <div class="flex flex-col gap-4">
        <PField :label="t('settings.general.accent')">
          <PColorInput v-model="color" />
        </PField>
        <PField :label="t('settings.general.mode')">
          <div>
            <PSegmented v-model="mode" :options="modeOptions" :aria-label="t('settings.general.mode')" />
          </div>
        </PField>
        <PField :label="t('settings.general.radius')">
          <div>
            <PSegmented
              v-model="radius"
              :options="radiusOptions"
              :aria-label="t('settings.general.radius')"
            />
          </div>
        </PField>
      </div>
      <!-- Live preview of the user-chosen theme (the only place raw colours are allowed). -->
      <div
        class="rounded-xl border border-line-2 p-4"
        :class="theme.mode === 'dark' ? 'bg-code-bg text-code-fg' : 'bg-bg-home'"
        aria-hidden="true"
      >
        <div class="eyebrow mb-3">{{ t('settings.general.preview') }}</div>
        <div class="mb-2 h-2.5 w-24 rounded-full bg-line" />
        <div class="mb-4 h-2 w-36 rounded-full bg-line-soft" />
        <div class="flex gap-2">
          <span
            class="inline-flex h-8 items-center px-3 text-sm font-bold text-on-accent"
            :style="{ background: theme.color, borderRadius: radiusPx }"
            >{{ t('settings.general.previewButton') }}</span
          >
          <span
            class="inline-flex h-8 items-center border px-3 text-sm font-semibold"
            :style="{ borderColor: theme.color, color: theme.color, borderRadius: radiusPx }"
            >{{ t('settings.general.previewSecondary') }}</span
          >
        </div>
      </div>
    </div>
  </SettingsCard>

  <SettingsCard :title="t('settings.general.danger')" tone="danger">
    <div class="flex flex-wrap items-center gap-3.5 border-b border-danger/10 px-5 py-3.5">
      <div class="min-w-[220px] flex-1">
        <div class="text-md font-semibold">{{ t('settings.general.archiveTitle') }}</div>
        <div class="mt-0.5 text-sm text-muted">{{ t('settings.general.archiveDesc') }}</div>
      </div>
      <PButton variant="danger" :icon="Archive" :disabled="!canDanger" @click="archiveOpen = true">{{
        t('settings.general.archive')
      }}</PButton>
    </div>
    <div class="flex flex-wrap items-center gap-3.5 px-5 py-3.5">
      <div class="min-w-[220px] flex-1">
        <div class="text-md font-semibold">{{ t('settings.general.deleteTitle') }}</div>
        <div class="mt-0.5 text-sm text-muted">{{ t('settings.general.deleteDesc') }}</div>
      </div>
      <PButton variant="danger" :icon="Trash2" :disabled="!canDanger" @click="deleteOpen = true">{{
        t('settings.general.delete')
      }}</PButton>
    </div>
    <p v-if="!canDanger" class="border-t border-danger/10 px-5 py-2.5 text-xs text-muted">
      {{ t('settings.general.ownersOnly') }}
    </p>
  </SettingsCard>

  <PDialog
    v-model:open="archiveOpen"
    :title="t('settings.general.archiveConfirmTitle', { name: def.definition?.name })"
    :description="t('settings.general.archiveDesc')"
    :icon="Archive"
  >
    <template #footer="{ close }">
      <PButton @click="close">{{ t('settings.cancel') }}</PButton>
      <PButton variant="ink" :loading="archive.isPending.value" @click="archive.mutate()">{{
        t('settings.general.archive')
      }}</PButton>
    </template>
  </PDialog>

  <PDialog
    v-model:open="deleteOpen"
    :title="t('settings.general.deleteConfirmTitle', { name: def.definition?.name })"
    :icon="TriangleAlert"
    :width="460"
  >
    <p class="mb-3 text-base text-fg-2">{{ t('settings.general.deleteConfirmBody') }}</p>
    <PField v-slot="{ id }" :label="t('settings.general.typeToConfirm', { slug: confirmTarget })">
      <PInput
        :id="id"
        v-model="confirmText"
        mono
        autocomplete="off"
        :placeholder="confirmTarget"
        @keydown.enter="confirmText === confirmTarget && remove.mutate()"
      />
    </PField>
    <template #footer="{ close }">
      <PButton @click="close">{{ t('settings.cancel') }}</PButton>
      <PButton
        variant="danger"
        class="border-danger bg-danger-bg"
        :disabled="confirmText !== confirmTarget"
        :loading="remove.isPending.value"
        @click="remove.mutate()"
      >
        {{ t('settings.general.deleteForever') }}
      </PButton>
    </template>
  </PDialog>
</template>
