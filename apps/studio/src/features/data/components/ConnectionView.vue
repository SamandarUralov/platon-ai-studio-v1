<script setup lang="ts">
/** Connection page: summary cards, editable details, per-environment credentials, tables, detach. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@tanstack/vue-query'
import { Database, Globe, Hash, Lock, Plug, Plus, Server, Tag, Trash2, Layers } from 'lucide-vue-next'
import {
  PBadge,
  PButton,
  PDialog,
  PIcon,
  PInput,
  PSelect,
  PSwitch,
  toast,
  toneClasses,
  type SelectOption,
} from '@platon/ui'
import { ENGINES, type DbConnection, type TestConnectionResponse } from '@platon/definition'
import { errorMessage } from '@/services/http'
import EngineLogo from './EngineLogo.vue'
import SecretDialog from './SecretDialog.vue'
import { dataApi } from '../api'
import { DB_ROLES, detachConnectionChange, ENV_NAMES, setConnectionPropChange, type Env } from '../lib/model'
import { tableName } from '../lib/ddl'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ conn: DbConnection }>()
const emit = defineEmits<{ openTable: [tableId: string]; newTable: []; detached: [] }>()
const { t } = useI18n()
const m = useData()
const eng = computed(() => ENGINES[props.conn.engine])
const tables = computed(() => m.tablesOf(props.conn.id))

const cards = computed(() => [
  { icon: Database, label: t('data.conn.engine'), value: eng.value.label },
  { icon: Globe, label: t('data.conn.host'), value: props.conn.host || '—' },
  { icon: Hash, label: t('data.conn.port'), value: String(props.conn.port ?? eng.value.port) },
  {
    icon: Server,
    label: props.conn.schema
      ? `${t('data.conn.database')} / ${t('data.conn.schema')}`
      : t('data.conn.database'),
    value: [props.conn.database, props.conn.schema].filter(Boolean).join(' / ') || '—',
  },
  {
    icon: Lock,
    label: t('data.conn.ssl'),
    value: props.conn.ssl ? t('data.conn.sslOn') : t('data.conn.sslOff'),
  },
  { icon: Tag, label: t('data.conn.role'), value: t(`data.roles.${props.conn.role}`) },
])

const roleOptions = computed<SelectOption<DbConnection['role']>[]>(() =>
  DB_ROLES.map((r) => ({ value: r, label: t(`data.roles.${r}`) })),
)

function setProp<K extends 'host' | 'database' | 'schema'>(k: K, v: string | number | null | undefined) {
  const s = String(v ?? '').trim()
  if ((props.conn[k] ?? '') === s) return
  m.edit(setConnectionPropChange(props.conn, k, s || undefined))
}
function setPort(v: string | number | null | undefined) {
  const n = Number(v)
  if (!n || n === props.conn.port) return
  m.edit(setConnectionPropChange(props.conn, 'port', n))
}

// ── tests per environment
const results = ref<Partial<Record<Env, TestConnectionResponse>>>({})
const testing = ref<Env | null>(null)
const test = useMutation({
  mutationFn: (env: Env) => dataApi.testConnection(m.pid.value, { connectionId: props.conn.id, env }),
  onMutate: (env) => (testing.value = env),
  onSuccess: (r, env) => {
    results.value = { ...results.value, [env]: r }
    toast(
      r.ok
        ? `${t(`data.envs.${env}`)}: ${t('data.conn.connected', { version: r.serverVersion ?? '', ms: r.latencyMs })}`
        : r.message,
      { tone: r.ok ? 'ok' : 'danger' },
    )
  },
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
  onSettled: () => (testing.value = null),
})

const secretEnv = ref<Env | null>(null)
const secretOpen = ref(false)
function replace(env: Env) {
  secretEnv.value = env
  secretOpen.value = true
}

const confirmDetach = ref(false)
function detach() {
  const name = props.conn.name
  if (m.edit(detachConnectionChange(props.conn, m.tables.value), t('data.conn.detached', { name }))) {
    confirmDetach.value = false
    emit('detached')
  }
}
</script>

<template>
  <div class="scroll-thin min-h-0 flex-1 overflow-auto px-6 pb-10 pt-4">
    <div class="flex flex-wrap items-center gap-3">
      <EngineLogo :engine="conn.engine" size="lg" class="border border-line-soft" />
      <div class="min-w-0">
        <h1 class="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{{ conn.name }}</h1>
        <div class="mt-0.5 font-mono text-xs text-faint">/data/connections/{{ conn.id }}</div>
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <span
          :class="[
            'inline-flex h-7 items-center rounded-lg px-2.5 text-sm font-bold',
            toneClasses[eng.tone].bg,
            toneClasses[eng.tone].fg,
          ]"
          >{{ eng.label }}</span
        >
        <span class="inline-flex h-7 items-center rounded-lg bg-subtle px-2.5 text-sm font-bold text-fg-2">{{
          t(`data.roles.${conn.role}`)
        }}</span>
        <PButton :icon="Plug" :loading="testing === 'development'" @click="test.mutate('development')">{{
          t('data.conn.test')
        }}</PButton>
        <PButton variant="danger" :icon="Trash2" @click="confirmDetach = true">{{
          t('data.conn.detach')
        }}</PButton>
      </div>
    </div>

    <div class="my-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
      <div
        v-for="c in cards"
        :key="c.label"
        class="min-w-0 rounded-xl border border-line-2 bg-surface px-4 py-3.5"
      >
        <div class="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <component :is="c.icon" :size="13" />{{ c.label }}
        </div>
        <div class="mt-1.5 truncate text-[14.5px] font-bold">{{ c.value }}</div>
      </div>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-4">
      <div class="flex flex-col gap-4">
        <section class="overflow-hidden rounded-[14px] border border-line-2 bg-surface">
          <header class="flex items-center border-b border-line-faint px-4.5 py-3 text-md font-bold">
            {{ t('data.conn.details') }}
          </header>
          <div class="divide-y divide-line-faint">
            <label class="flex items-center gap-3 px-4.5 py-2"
              ><span class="w-28 shrink-0 text-sm text-muted">{{ t('data.conn.host') }}</span>
              <PInput
                :model-value="conn.host ?? ''"
                size="sm"
                mono
                class="flex-1"
                @change="setProp('host', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="flex items-center gap-3 px-4.5 py-2"
              ><span class="w-28 shrink-0 text-sm text-muted">{{ t('data.conn.port') }}</span>
              <PInput
                :model-value="conn.port ?? eng.port"
                size="sm"
                mono
                inputmode="numeric"
                class="flex-1"
                @change="setPort(($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="flex items-center gap-3 px-4.5 py-2"
              ><span class="w-28 shrink-0 text-sm text-muted">{{ t('data.conn.database') }}</span>
              <PInput
                :model-value="conn.database ?? ''"
                size="sm"
                mono
                class="flex-1"
                @change="setProp('database', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label
              v-if="conn.engine === 'postgres' || conn.engine === 'mssql'"
              class="flex items-center gap-3 px-4.5 py-2"
              ><span class="w-28 shrink-0 text-sm text-muted">{{ t('data.conn.schema') }}</span>
              <PInput
                :model-value="conn.schema ?? ''"
                size="sm"
                mono
                class="flex-1"
                @change="setProp('schema', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <div class="flex items-center gap-3 px-4.5 py-2">
              <span class="w-28 shrink-0 text-sm text-muted">{{ t('data.conn.role') }}</span>
              <PSelect
                :model-value="conn.role"
                :options="roleOptions"
                size="sm"
                class="flex-1"
                :aria-label="t('data.conn.role')"
                @update:model-value="(v) => v && m.edit(setConnectionPropChange(conn, 'role', v))"
              />
            </div>
            <div class="flex items-center gap-3 px-4.5 py-2.5">
              <span class="w-28 shrink-0 text-sm text-muted">{{ t('data.conn.ssl') }}</span>
              <PSwitch
                :model-value="!!conn.ssl"
                :label="t('data.conn.ssl')"
                @update:model-value="(v) => m.edit(setConnectionPropChange(conn, 'ssl', v))"
              />
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-[14px] border border-line-2 bg-surface">
          <header class="border-b border-line-faint px-4.5 py-3">
            <div class="text-md font-bold">{{ t('data.conn.credentials') }}</div>
            <div class="mt-0.5 text-xs text-faint">{{ t('data.conn.credentialsHint') }}</div>
          </header>
          <div
            v-for="env in ENV_NAMES"
            :key="env"
            class="flex items-center gap-2.5 border-b border-line-faint px-4.5 py-2.5 last:border-b-0"
          >
            <span class="w-24 shrink-0 text-sm text-muted">{{ t(`data.envs.${env}`) }}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <PBadge v-if="conn.credentials?.[env]" tone="ok" dot size="xs">{{
                  t('data.conn.set')
                }}</PBadge>
                <PBadge v-else tone="warn" size="xs">{{ t('data.conn.notSet') }}</PBadge>
                <PBadge
                  v-if="results[env]"
                  :tone="results[env]!.ok ? 'ok' : 'danger'"
                  size="xs"
                  :title="results[env]!.message"
                >
                  {{ results[env]!.ok ? `${results[env]!.latencyMs} ms` : t('data.conn.failed') }}
                </PBadge>
              </div>
              <div
                v-if="conn.credentials?.[env]"
                class="mt-0.5 truncate font-mono text-2xs text-faint"
                :title="conn.credentials[env]"
              >
                •••••••• · {{ conn.credentials[env] }}
              </div>
            </div>
            <PButton
              size="xs"
              variant="ghost"
              :loading="testing === env"
              :disabled="!conn.credentials?.[env]"
              @click="test.mutate(env)"
              >{{ t('data.conn.testShort') }}</PButton
            >
            <PButton size="xs" @click="replace(env)">{{
              conn.credentials?.[env] ? t('data.conn.replace') : t('data.conn.add')
            }}</PButton>
          </div>
        </section>
      </div>

      <section class="overflow-hidden rounded-[14px] border border-line-2 bg-surface">
        <header class="flex items-center border-b border-line-faint px-4.5 py-2.5 text-md font-bold">
          {{ eng.kind }} <span class="ml-1.5 text-2xs font-bold text-faint-2">{{ tables.length }}</span>
          <PButton variant="primary" size="xs" :icon="Plus" class="ml-auto" @click="emit('newTable')">{{
            t('data.newUnit', { unit: eng.unit })
          }}</PButton>
        </header>
        <button
          v-for="tb in tables"
          :key="tb.id"
          type="button"
          class="flex w-full items-center gap-2.5 border-b border-line-faint px-4.5 py-2.5 text-left last:border-b-0 hover:bg-hover"
          @click="emit('openTable', tb.id)"
        >
          <PIcon :name="tb.icon" :size="15" class="text-muted" />
          <span class="min-w-0 flex-1">
            <span class="block text-md font-semibold">{{ tb.name }}</span>
            <span class="block truncate font-mono text-xs text-faint">{{
              tb.physicalName ?? tableName(tb)
            }}</span>
          </span>
          <span class="text-xs text-faint">{{ t('data.conn.fields', { n: tb.fields.length }) }}</span>
          <span class="w-10 text-right text-xs tabular-nums text-faint">{{ m.count(tb.id) ?? '' }}</span>
        </button>
        <div v-if="!tables.length" class="flex items-center gap-2 px-4.5 py-5 text-base text-faint">
          <Layers :size="14" />{{ t('data.conn.empty') }}
        </div>
      </section>
    </div>

    <SecretDialog v-model:open="secretOpen" :conn="conn" :env="secretEnv" />
    <PDialog
      v-model:open="confirmDetach"
      :icon="Trash2"
      :width="440"
      :title="t('data.conn.detachTitle', { name: conn.name })"
      :description="t('data.conn.detachBody', { count: tables.length, kind: eng.kind.toLowerCase() })"
    >
      <template #footer="{ close }">
        <PButton @click="close">{{ t('data.fields.cancel') }}</PButton>
        <PButton variant="danger-solid" @click="detach">{{ t('data.conn.detach') }}</PButton>
      </template>
    </PDialog>
  </div>
</template>
