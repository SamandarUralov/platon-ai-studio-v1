<script setup lang="ts">
/**
 * Sign-in & security. Which methods are on lives in the definition (settings.signIn, ships with a release);
 * provider connection details, policies and secrets live behind /auth (secrets are write-only).
 */
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronUp, Copy, LockKeyhole, Mail, TriangleAlert } from 'lucide-vue-next'
import {
  PBadge,
  PButton,
  PField,
  PInput,
  PSelect,
  PSpinner,
  PSwitch,
  cn,
  toast,
  toneClasses,
  type SelectOption,
} from '@platon/ui'
import type {
  AppSettings,
  AuthProviderId,
  AuthSettings,
  LockoutPolicy,
  MfaPolicy,
  SessionLength,
  SignupPolicy,
  UpdateAuthProviderRequest,
  UpdateAuthSettingsRequest,
} from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'
import { http } from '@/services/http'
import SettingsCard from '../components/SettingsCard.vue'
import SecretField from '../components/SecretField.vue'
import ToggleRow from '../components/ToggleRow.vue'
import { settingsKeys, useAuthSettings, useResourceMutation } from '../api'
import { PROVIDERS, type ProviderSpec } from '../catalog'

type SignIn = NonNullable<AppSettings['signIn']>[number]

const { t } = useI18n()
const def = useDefinitionStore()
const pid = useProjectId()
const auth = useAuthSettings(pid)

const signIn = computed<SignIn[]>(() => def.definition!.settings.signIn ?? [])
function setSignIn(id: SignIn, on: boolean, label: string) {
  const next = on ? [...new Set([...signIn.value, id])] : signIn.value.filter((x) => x !== id)
  def.apply({
    key: `settings.signIn.${id}`,
    area: 'Settings',
    text: `${on ? 'Enabled' : 'Disabled'} ${label} sign-in`,
    ops: [{ op: def.definition!.settings.signIn ? 'replace' : 'add', path: '/settings/signIn', value: next }],
  })
}

const patchAuth = useResourceMutation(
  () => settingsKeys.auth(pid.value),
  async (body: UpdateAuthSettingsRequest) =>
    (await http.patch<AuthSettings>(`/projects/${pid.value}/auth`, body)).data,
)
const patchProvider = useResourceMutation(
  () => settingsKeys.auth(pid.value),
  async (v: { id: AuthProviderId; body: UpdateAuthProviderRequest }) =>
    (await http.patch<AuthSettings>(`/projects/${pid.value}/auth/providers/${v.id}`, v.body)).data,
  { success: (_r, v) => (v.body.secrets ? t('settings.auth.secretSaved') : undefined) },
)

const password = computed({
  get: () => signIn.value.includes('password'),
  set: (v: boolean) => setSignIn('password', v, 'email and password'),
})
const magic = computed({
  get: () => !!auth.data.value?.methods.magicLink,
  set: (v: boolean) => patchAuth.mutate({ methods: { magicLink: v } }),
})

// ── Providers ────────────────────────────────────────────────────────────────────────
const open = ref<AuthProviderId | null>(null)
const host = computed(() => `https://${def.definition!.settings.slug ?? pid.value}.platon.app`)
const roleOptions = computed<SelectOption<string>[]>(() =>
  def.definition!.roles.map((r) => ({ value: r.id, label: r.name })),
)

/** Local drafts of non-secret fields, saved on blur. */
const drafts = reactive<Record<string, Record<string, string>>>({})
watch(
  () => auth.data.value,
  (a) => {
    if (!a) return
    for (const p of PROVIDERS) drafts[p.id] = { ...a.providers[p.id].fields }
  },
  { immediate: true },
)

function ready(p: ProviderSpec, a: AuthSettings) {
  const cfg = a.providers[p.id]
  return p.fields.every((f) => (f.secret ? cfg.secrets[f.key] : !!cfg.fields[f.key]?.trim()))
}
function status(p: ProviderSpec): { label: string; tone: 'ok' | 'warn' | 'neutral' } {
  const a = auth.data.value
  if (!signIn.value.includes(p.id)) return { label: t('settings.auth.off'), tone: 'neutral' }
  return a && ready(p, a)
    ? { label: t('settings.auth.enabled'), tone: 'ok' }
    : { label: t('settings.auth.needsSetup'), tone: 'warn' }
}
function toggleProvider(p: ProviderSpec, on: boolean) {
  setSignIn(p.id, on, t(`settings.auth.providers.${p.id}.name`))
  const a = auth.data.value
  if (on && a && !ready(p, a)) {
    open.value = p.id
    toast(t('settings.auth.finishSetup', { name: t(`settings.auth.providers.${p.id}.name`) }), {
      tone: 'warn',
    })
  }
}
function saveField(p: ProviderSpec, key: string) {
  const v = drafts[p.id]?.[key] ?? ''
  if (v === (auth.data.value?.providers[p.id].fields[key] ?? '')) return
  patchProvider.mutate({ id: p.id, body: { fields: { [key]: v.trim() } } })
}
function copyCallback(id: AuthProviderId) {
  void navigator.clipboard?.writeText(`${host.value}/auth/callback/${id}`)
  toast(t('settings.auth.copied'))
}
const enabledCount = computed(() => PROVIDERS.filter((p) => signIn.value.includes(p.id)).length)

// ── Policies ─────────────────────────────────────────────────────────────────────────
const opts = <T extends string>(group: string, ids: T[]): SelectOption<T>[] =>
  ids.map((id) => ({ value: id, label: t(`settings.auth.${group}.${id}`) }))
const signupOptions = computed(() => opts<SignupPolicy>('signupOpts', ['invite', 'domains', 'anyone']))
const mfaOptions = computed(() => opts<MfaPolicy>('mfaOpts', ['off', 'optional', 'staff', 'everyone']))
const sessionOptions = computed(() => opts<SessionLength>('sessionOpts', ['1h', '8h', '7d', '30d']))
const lockoutOptions = computed(() => opts<LockoutPolicy>('lockoutOpts', ['never', '5_15m', '10_1h']))

function policy<K extends 'signup' | 'mfa' | 'session' | 'lockout'>(k: K) {
  return computed({
    get: () => auth.data.value?.[k],
    set: (v: AuthSettings[K] | undefined) => v && patchAuth.mutate({ [k]: v }),
  })
}
const signup = policy('signup')
const mfa = policy('mfa')
const session = policy('session')
const lockout = policy('lockout')

const domains = ref('')
watch(
  () => auth.data.value?.allowedDomains,
  (d) => (domains.value = (d ?? []).join(', ')),
  { immediate: true },
)
function saveDomains() {
  const list = domains.value
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
  if (list.join(',') === (auth.data.value?.allowedDomains ?? []).join(',')) return
  patchAuth.mutate({ allowedDomains: list })
}

const warning = computed(() => {
  const a = auth.data.value
  if (!a) return null
  if (!signIn.value.length && !a.methods.magicLink) return t('settings.auth.warnNone')
  if (a.signup === 'anyone' && a.mfa === 'off') return t('settings.auth.warnOpen')
  return null
})
</script>

<template>
  <div v-if="auth.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <template v-else-if="auth.data.value">
    <SettingsCard :title="t('settings.auth.methodsTitle')" :description="t('settings.auth.methodsDesc')">
      <ToggleRow
        v-model="password"
        :icon="LockKeyhole"
        :label="t('settings.auth.password')"
        :description="t('settings.auth.passwordDesc')"
      />
      <ToggleRow
        v-model="magic"
        :icon="Mail"
        :label="t('settings.auth.magic')"
        :description="t('settings.auth.magicDesc')"
      />
    </SettingsCard>

    <SettingsCard
      :title="t('settings.auth.providersTitle')"
      :description="t('settings.auth.providersDesc', { n: enabledCount, total: PROVIDERS.length })"
    >
      <div v-for="p in PROVIDERS" :key="p.id" class="border-b border-line-faint last:border-b-0">
        <div class="flex flex-wrap items-center gap-3 px-[18px] py-3">
          <div
            :class="
              cn(
                'grid size-8 shrink-0 place-items-center rounded-lg text-sm font-extrabold',
                toneClasses[p.tone].bg,
                toneClasses[p.tone].fg,
              )
            "
          >
            {{ p.mono }}
          </div>
          <div class="min-w-[160px] flex-1">
            <div class="flex items-center gap-2 text-md font-semibold">
              {{ t(`settings.auth.providers.${p.id}.name`) }}
              <PBadge size="xs" :tone="status(p).tone">{{ status(p).label }}</PBadge>
            </div>
            <div class="mt-0.5 text-sm text-muted">{{ t(`settings.auth.providers.${p.id}.desc`) }}</div>
          </div>
          <PButton
            size="xs"
            :icon-right="open === p.id ? ChevronUp : ChevronDown"
            :aria-expanded="open === p.id"
            @click="open = open === p.id ? null : p.id"
          >
            {{ open === p.id ? t('settings.auth.close') : t('settings.auth.configure') }}
          </PButton>
          <PSwitch
            :model-value="signIn.includes(p.id)"
            :label="t(`settings.auth.providers.${p.id}.name`)"
            @update:model-value="(v) => toggleProvider(p, v)"
          />
        </div>
        <div
          v-if="open === p.id"
          class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 px-[18px] pb-4 pl-[62px]"
        >
          <PField
            v-for="f in p.fields"
            :key="f.key"
            v-slot="{ id }"
            :label="t(`settings.auth.fields.${f.key}`)"
            :hint="f.secret ? t('settings.auth.secretHint') : undefined"
          >
            <SecretField
              v-if="f.secret"
              :id="id"
              :label="t(`settings.auth.fields.${f.key}`)"
              :set="!!auth.data.value.providers[p.id].secrets[f.key]"
              :saving="patchProvider.isPending.value"
              @save="(v) => patchProvider.mutate({ id: p.id, body: { secrets: { [f.key]: v } } })"
            />
            <PInput
              v-else-if="drafts[p.id]"
              :id="id"
              v-model="drafts[p.id]![f.key]"
              mono
              :placeholder="f.placeholder"
              @blur="saveField(p, f.key)"
              @keydown.enter="saveField(p, f.key)"
            />
          </PField>
          <PField :label="t('settings.auth.defaultRole')" :hint="t('settings.auth.defaultRoleHint')">
            <PSelect
              :model-value="auth.data.value.providers[p.id].defaultRole"
              :options="roleOptions"
              :aria-label="t('settings.auth.defaultRole')"
              @update:model-value="(r) => r && patchProvider.mutate({ id: p.id, body: { defaultRole: r } })"
            />
          </PField>
          <PField
            v-if="p.oauth"
            :label="t('settings.auth.redirect')"
            :hint="t('settings.auth.redirectHint')"
            class="col-span-full"
          >
            <div
              class="flex h-[34px] items-center gap-2 rounded-[9px] border border-line-2 bg-subtle pl-2.5 pr-1"
            >
              <span class="min-w-0 flex-1 truncate font-mono text-sm text-fg-2"
                >{{ host }}/auth/callback/{{ p.id }}</span
              >
              <PButton size="xs" variant="ghost" :icon="Copy" @click="copyCallback(p.id)">{{
                t('settings.auth.copy')
              }}</PButton>
            </div>
          </PField>
        </div>
      </div>
    </SettingsCard>

    <SettingsCard :title="t('settings.auth.policiesTitle')" :description="t('settings.auth.policiesDesc')">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5 p-[18px]">
        <PField :label="t('settings.auth.signup')" :hint="t('settings.auth.signupHint')"
          ><PSelect v-model="signup" :options="signupOptions" :aria-label="t('settings.auth.signup')"
        /></PField>
        <PField :label="t('settings.auth.mfa')" :hint="t('settings.auth.mfaHint')"
          ><PSelect v-model="mfa" :options="mfaOptions" :aria-label="t('settings.auth.mfa')"
        /></PField>
        <PField :label="t('settings.auth.session')" :hint="t('settings.auth.sessionHint')"
          ><PSelect v-model="session" :options="sessionOptions" :aria-label="t('settings.auth.session')"
        /></PField>
        <PField :label="t('settings.auth.lockout')" :hint="t('settings.auth.lockoutHint')"
          ><PSelect v-model="lockout" :options="lockoutOptions" :aria-label="t('settings.auth.lockout')"
        /></PField>
      </div>
      <div v-if="auth.data.value.signup === 'domains'" class="px-[18px] pb-4">
        <PField v-slot="{ id }" :label="t('settings.auth.domains')" :hint="t('settings.auth.domainsHint')">
          <PInput
            :id="id"
            v-model="domains"
            mono
            placeholder="acme-facilities.com, partner.com"
            @blur="saveDomains"
            @keydown.enter="saveDomains"
          />
        </PField>
      </div>
    </SettingsCard>

    <div
      v-if="warning"
      role="alert"
      class="flex gap-2.5 rounded-[11px] border border-warn/30 bg-warn-bg px-3.5 py-3 text-sm leading-snug text-warn"
    >
      <TriangleAlert :size="15" class="mt-px shrink-0" />{{ warning }}
    </div>
  </template>
</template>
