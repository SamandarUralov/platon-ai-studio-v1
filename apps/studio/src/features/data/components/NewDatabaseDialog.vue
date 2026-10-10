<script setup lang="ts">
/** New database connection: engine, name, role, host/port/db/schema/user/password or URI, SSL, test. */
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleAlert, CircleCheck, Database, Info, Plug } from 'lucide-vue-next'
import {
  PButton,
  PDialog,
  PField,
  PInput,
  PSegmented,
  PSelect,
  PSwitch,
  toast,
  type SelectOption,
} from '@platon/ui'
import {
  ENGINES,
  snake,
  uniqueName,
  type DbConnection,
  type DbEngine,
  type TestConnectionResponse,
} from '@platon/definition'
import { errorMessage } from '@/services/http'
import EngineLogo from './EngineLogo.vue'
import { dataApi } from '../api'
import { addConnectionChange, DB_ROLES } from '../lib/model'
import { useData } from '../composables/useDataModel'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [connId: string] }>()
const { t } = useI18n()
const m = useData()
const ENGINE_IDS = Object.keys(ENGINES) as DbEngine[]

const blank = () => ({
  engine: 'postgres' as DbEngine,
  name: '',
  role: 'primary' as DbConnection['role'],
  mode: 'fields' as 'fields' | 'uri',
  host: '',
  port: ENGINES.postgres.port as number | string,
  database: '',
  schema: 'public',
  user: '',
  password: '',
  uri: '',
  ssl: true,
})
const form = reactive(blank())
const tested = ref<TestConnectionResponse | null>(null)
const testing = ref(false)
const creating = ref(false)
const error = ref<string | null>(null)

watch(open, (o) => {
  if (o) {
    Object.assign(form, blank())
    tested.value = null
    error.value = null
  }
})
watch(
  () => form.engine,
  (e) => {
    form.port = ENGINES[e].port
    form.schema = e === 'postgres' ? 'public' : e === 'mssql' ? 'dbo' : ''
    form.role = e === 'redis' ? 'cache' : form.role === 'cache' ? 'primary' : form.role
    tested.value = null
  },
)
watch(
  () => [form.host, form.port, form.database, form.user, form.password, form.uri, form.mode],
  () => (tested.value = null),
)

const roleOptions = computed<SelectOption<DbConnection['role']>[]>(() =>
  DB_ROLES.map((r) => ({ value: r, label: t(`data.roles.${r}`) })),
)
const modeOptions = computed(() => [
  { value: 'fields' as const, label: t('data.newDb.fields') },
  { value: 'uri' as const, label: t('data.newDb.uri') },
])
const hasSchema = computed(() => form.engine === 'postgres' || form.engine === 'mssql')
const uriPh = computed(
  () =>
    `${form.engine === 'mongo' ? 'mongodb' : form.engine === 'mssql' ? 'sqlserver' : form.engine}://user:password@host:${ENGINES[form.engine].port}/db`,
)
const secret = computed(() => (form.mode === 'uri' ? form.uri : form.password))

async function test() {
  testing.value = true
  try {
    tested.value = await dataApi.testConnection(m.pid.value, {
      env: 'development',
      engine: form.engine,
      host: form.mode === 'uri' ? undefined : form.host.trim(),
      port: Number(form.port) || ENGINES[form.engine].port,
      database: form.database.trim() || undefined,
      user: form.user.trim() || undefined,
      password: form.mode === 'fields' ? form.password : undefined,
      uri: form.mode === 'uri' ? form.uri : undefined,
      ssl: form.ssl,
    })
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    testing.value = false
  }
}

async function create() {
  const name = form.name.trim()
  if (!name) return (error.value = t('data.newDb.needName'))
  if (form.mode === 'fields' && !form.host.trim()) return (error.value = t('data.newDb.needHost'))
  error.value = null
  creating.value = true
  try {
    const id = uniqueName(
      snake(name) || 'db',
      m.connections.value.map((c) => c.id),
    )
    const conn: DbConnection = { id, name, engine: form.engine, role: form.role, ssl: form.ssl }
    if (form.mode === 'fields') {
      conn.host = form.host.trim()
      conn.port = Number(form.port) || ENGINES[form.engine].port
      if (form.database.trim()) conn.database = form.database.trim()
      if (hasSchema.value && form.schema.trim()) conn.schema = form.schema.trim()
    } else {
      // Non-secret parts of the URI are kept for display; the full URI goes to the vault.
      const u = /^[a-z+]+:\/\/(?:[^@/]*@)?([^:/?]+)(?::(\d+))?(?:\/([^?]*))?/i.exec(form.uri.trim())
      if (u?.[1]) conn.host = u[1]
      conn.port = Number(u?.[2]) || ENGINES[form.engine].port
      if (u?.[3]) conn.database = u[3]
    }
    if (secret.value)
      conn.credentials = {
        development: (await dataApi.putSecret(m.pid.value, id, 'development', secret.value)).ref,
      }
    if (m.edit(addConnectionChange(conn), t('data.newDb.created', { name }))) {
      open.value = false
      emit('created', id)
    }
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    creating.value = false
    form.password = ''
    form.uri = ''
  }
}
</script>

<template>
  <PDialog
    v-model:open="open"
    :icon="Database"
    :width="660"
    :title="t('data.newDb.title')"
    :description="t('data.newDb.desc')"
  >
    <form id="new-db" class="flex flex-col gap-3.5" autocomplete="off" @submit.prevent="create">
      <div role="radiogroup" :aria-label="t('data.conn.engine')" class="grid grid-cols-5 gap-2">
        <button
          v-for="e in ENGINE_IDS"
          :key="e"
          type="button"
          role="radio"
          :aria-checked="form.engine === e"
          class="flex flex-col items-center gap-1.5 rounded-[11px] border-[1.5px] px-2 py-3 text-center"
          :class="form.engine === e ? 'border-primary bg-primary-tint/50' : 'border-line-soft hover:bg-hover'"
          @click="form.engine = e"
        >
          <EngineLogo :engine="e" size="lg" />
          <span class="text-sm font-bold">{{ ENGINES[e].label }}</span>
          <span class="text-2xs text-faint">{{ ENGINES[e].kind }}</span>
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2.5">
        <PField
          v-slot="{ id }"
          :label="t('data.newDb.name')"
          required
          :error="error === t('data.newDb.needName') ? error : null"
        >
          <PInput :id="id" v-model="form.name" :placeholder="t('data.newDb.namePh')" />
        </PField>
        <PField :label="t('data.newDb.role')">
          <PSelect v-model="form.role" :options="roleOptions" :aria-label="t('data.newDb.role')" />
        </PField>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-semibold text-fg-2">{{ t('data.newDb.mode') }}</span>
        <PSegmented v-model="form.mode" :options="modeOptions" :aria-label="t('data.newDb.mode')" />
      </div>
      <div v-if="form.mode === 'fields'" class="grid grid-cols-[minmax(0,1fr)_110px] gap-2.5">
        <PField
          v-slot="{ id }"
          :label="t('data.newDb.host')"
          required
          :error="error === t('data.newDb.needHost') ? error : null"
        >
          <PInput :id="id" v-model="form.host" mono placeholder="db.example.internal" />
        </PField>
        <PField v-slot="{ id }" :label="t('data.newDb.port')">
          <PInput :id="id" v-model="form.port" mono inputmode="numeric" />
        </PField>
        <div class="col-span-2 grid gap-2.5" :class="hasSchema ? 'grid-cols-2' : 'grid-cols-1'">
          <PField v-slot="{ id }" :label="t('data.newDb.database')">
            <PInput
              :id="id"
              v-model="form.database"
              mono
              :placeholder="form.engine === 'redis' ? '0' : 'app'"
            />
          </PField>
          <PField v-if="hasSchema" v-slot="{ id }" :label="t('data.newDb.schema')">
            <PInput :id="id" v-model="form.schema" mono />
          </PField>
        </div>
        <div class="col-span-2 grid grid-cols-2 gap-2.5">
          <PField v-slot="{ id }" :label="t('data.newDb.user')">
            <PInput :id="id" v-model="form.user" mono autocomplete="off" />
          </PField>
          <PField v-slot="{ id }" :label="t('data.newDb.password')">
            <PInput :id="id" v-model="form.password" type="password" mono autocomplete="new-password" />
          </PField>
        </div>
      </div>
      <PField v-else v-slot="{ id }" :label="t('data.newDb.uri')">
        <PInput
          :id="id"
          v-model="form.uri"
          type="password"
          mono
          :placeholder="uriPh"
          autocomplete="new-password"
        />
      </PField>
      <PField inline :label="t('data.newDb.ssl')">
        <PSwitch v-model="form.ssl" :label="t('data.newDb.ssl')" />
      </PField>
      <div class="flex gap-2 text-xs leading-snug text-muted">
        <Info :size="13" class="mt-px shrink-0" />{{ t('data.newDb.env') }}
      </div>
    </form>
    <template #footer="{ close }">
      <PButton :icon="Plug" :loading="testing" class="mr-auto" @click="test">{{
        t('data.newDb.test')
      }}</PButton>
      <span
        v-if="tested"
        class="mr-auto inline-flex items-center gap-1.5 text-sm font-semibold"
        :class="tested.ok ? 'text-ok' : 'text-danger'"
      >
        <CircleCheck v-if="tested.ok" :size="14" /><CircleAlert v-else :size="14" />
        {{
          tested.ok
            ? t('data.conn.connected', { version: tested.serverVersion ?? '', ms: tested.latencyMs })
            : tested.message
        }}
      </span>
      <PButton @click="close">{{ t('data.fields.cancel') }}</PButton>
      <PButton
        variant="primary"
        type="submit"
        form="new-db"
        :loading="creating"
        :disabled="!form.name.trim()"
        >{{ t('data.newDb.create') }}</PButton
      >
    </template>
  </PDialog>
</template>
