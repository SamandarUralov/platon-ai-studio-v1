<script setup lang="ts">
/** Databases: managed engines on the Studio server (PostgreSQL, MySQL, Redis) and the databases on them. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, RotateCw, Server } from 'lucide-vue-next'
import { PBadge, PButton, PField, PInput, PSelect, PSpinner, cn, type SelectOption } from '@platon/ui'
import type {
  CreateDatabaseRequest,
  DatabasesResponse,
  DbBackupSchedule,
  ManagedDatabase,
  ManagedEngineId,
} from '@platon/definition'
import { fmtBytes } from '@/composables/format'
import { http } from '@/services/http'
import AdminCard from '../components/AdminCard.vue'
import { adminKeys, useAdminMutation, useAdminProjects, useDatabases } from '../api'

const { t } = useI18n()
const dbs = useDatabases()
const projects = useAdminProjects()

const DOT: Record<ManagedEngineId, string> = { pg: 'bg-info', mysql: 'bg-teal', redis: 'bg-danger-dot' }
const engineName = (id: ManagedEngineId) => dbs.data.value?.engines.find((e) => e.id === id)?.name ?? id

const restart = useAdminMutation(
  async (id: ManagedEngineId) =>
    (await http.post<DatabasesResponse>(`/admin/databases/engines/${id}/restart`)).data,
  {
    key: adminKeys.databases,
    success: (_r, id) => t('admin.db.restarted', { name: engineName(id) }),
  },
)
const setBackup = useAdminMutation(
  async (v: { name: string; backup: DbBackupSchedule }) =>
    (await http.patch<DatabasesResponse>(`/admin/databases/${v.name}`, { backup: v.backup })).data,
  { key: adminKeys.databases },
)
const backupNow = useAdminMutation(async (name: string) => http.post(`/admin/databases/${name}/backup`), {
  success: (_r, n) => t('admin.db.backupStarted', { name: n }),
})
const create = useAdminMutation(
  async (b: CreateDatabaseRequest) => (await http.post<DatabasesResponse>('/admin/databases', b)).data,
  { key: adminKeys.databases, success: (_r, b) => t('admin.db.created', { name: b.name }) },
)

const backupOptions = computed<SelectOption<DbBackupSchedule>[]>(() =>
  (['off', 'weekly', 'daily', '6h', 'hourly'] as const).map((b) => ({
    value: b,
    label: t(`admin.db.backups.${b}`),
  })),
)
const engineOptions = computed<SelectOption<ManagedEngineId>[]>(() =>
  (dbs.data.value?.engines ?? []).map((e) => ({ value: e.id, label: `${e.name} ${e.version}` })),
)
const projectOptions = computed<SelectOption<string>[]>(() =>
  (projects.data.value ?? [])
    .filter((p) => p.status !== 'archived')
    .map((p) => ({ value: p.name, label: p.name })),
)
const envOptions = computed<SelectOption<ManagedDatabase['env']>[]>(() =>
  (['development', 'staging', 'production'] as const).map((e) => ({
    value: e,
    label: t(`admin.db.envs.${e}`),
  })),
)

const adding = ref(false)
const form = ref<CreateDatabaseRequest>({ name: '', engine: 'pg', project: '', env: 'development' })
function startAdd() {
  form.value = { name: '', engine: 'pg', project: projectOptions.value[0]?.value ?? '', env: 'development' }
  adding.value = true
}
function submit() {
  create.mutate({ ...form.value }, { onSuccess: () => (adding.value = false) })
}
</script>

<template>
  <div v-if="dbs.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <template v-else-if="dbs.data.value">
    <div class="flex items-center gap-2 text-sm text-muted">
      <Server :size="14" class="shrink-0" />{{ t('admin.db.host', { host: dbs.data.value.host }) }}
    </div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
      <div
        v-for="e in dbs.data.value.engines"
        :key="e.id"
        class="rounded-[14px] border border-line-2 bg-surface p-4"
      >
        <div class="flex items-center gap-2.5">
          <span :class="cn('size-2.5 rounded-[3px]', DOT[e.id])" />
          <span class="text-lg font-bold">{{ e.name }}</span>
          <span class="font-mono text-xs text-faint">{{ e.version }} · :{{ e.port }}</span>
          <PBadge size="xs" :tone="e.running ? 'ok' : 'neutral'" dot class="ml-auto">{{
            e.running ? t('admin.db.running') : t('admin.db.stopped')
          }}</PBadge>
        </div>
        <div class="mt-3 text-xs text-fg-2">
          {{ t('admin.db.disk', { used: e.diskUsedGb, total: e.diskTotalGb }) }}
        </div>
        <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft">
          <div
            class="h-full rounded-full bg-primary"
            :style="{ width: `${Math.round((e.diskUsedGb / e.diskTotalGb) * 100)}%` }"
          />
        </div>
        <div class="mt-3 flex items-center text-xs text-muted">
          <span>{{ t('admin.db.connections', { n: e.connections, max: e.maxConnections }) }}</span>
          <PButton
            size="xs"
            class="ml-auto"
            :icon="RotateCw"
            :loading="restart.isPending.value && restart.variables.value === e.id"
            @click="restart.mutate(e.id)"
            >{{ t('admin.db.restart') }}</PButton
          >
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <h2 class="text-[15.5px] font-bold">{{ t('admin.db.databases') }}</h2>
      <PButton variant="primary" class="ml-auto" :icon="Plus" @click="startAdd">{{
        t('admin.db.create')
      }}</PButton>
    </div>
    <div
      v-if="adding"
      class="flex flex-wrap items-end gap-2.5 rounded-xl border border-primary-ring bg-primary-tint/40 p-3.5"
    >
      <PField v-slot="{ id }" :label="t('admin.db.name')" class="min-w-[160px] flex-1">
        <PInput
          :id="id"
          :model-value="form.name"
          mono
          placeholder="fleet_dev"
          @update:model-value="
            (v) =>
              (form.name = String(v ?? '')
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '_'))
          "
          @keydown.enter="submit"
        />
      </PField>
      <PField :label="t('admin.db.engine')" class="w-[170px]"
        ><PSelect v-model="form.engine" :options="engineOptions" :aria-label="t('admin.db.engine')"
      /></PField>
      <PField :label="t('admin.db.project')" class="w-[200px]"
        ><PSelect v-model="form.project" :options="projectOptions" :aria-label="t('admin.db.project')"
      /></PField>
      <PField :label="t('admin.db.env')" class="w-[140px]"
        ><PSelect v-model="form.env" :options="envOptions" :aria-label="t('admin.db.env')"
      /></PField>
      <PButton
        variant="primary"
        size="md"
        :disabled="!form.name"
        :loading="create.isPending.value"
        @click="submit"
        >{{ t('admin.db.createShort') }}</PButton
      >
      <PButton variant="ghost" size="md" @click="adding = false">{{ t('admin.cancel') }}</PButton>
    </div>
    <AdminCard>
      <div class="overflow-x-auto scroll-thin">
        <div class="min-w-[900px]">
          <div
            class="grid grid-cols-[minmax(150px,1fr)_120px_minmax(160px,1.2fr)_110px_80px_140px_110px] border-b border-line-soft bg-bg-home text-xs font-semibold text-muted"
          >
            <div class="px-3.5 py-2.5">{{ t('admin.db.database') }}</div>
            <div class="px-3.5 py-2.5">{{ t('admin.db.engine') }}</div>
            <div class="px-3.5 py-2.5">{{ t('admin.db.project') }}</div>
            <div class="px-3.5 py-2.5">{{ t('admin.db.env') }}</div>
            <div class="px-3.5 py-2.5">{{ t('admin.db.size') }}</div>
            <div class="px-3.5 py-2.5">{{ t('admin.db.backup') }}</div>
            <div />
          </div>
          <div
            v-for="d in dbs.data.value.databases"
            :key="d.name"
            class="grid grid-cols-[minmax(150px,1fr)_120px_minmax(160px,1.2fr)_110px_80px_140px_110px] items-center border-b border-line-faint text-base last:border-b-0"
          >
            <div class="px-3.5 py-2.5 font-mono text-sm font-semibold">{{ d.name }}</div>
            <div class="flex items-center gap-1.5 px-3.5 py-2.5">
              <span :class="cn('size-2 rounded-[2px]', DOT[d.engine])" />{{ engineName(d.engine) }}
            </div>
            <div class="truncate px-3.5 py-2.5 text-fg-2">{{ d.project }}</div>
            <div class="px-3.5 py-2.5 text-fg-2">{{ t(`admin.db.envs.${d.env}`) }}</div>
            <div class="px-3.5 py-2.5 text-fg-2">{{ fmtBytes(d.sizeBytes) }}</div>
            <div class="px-3.5 py-2">
              <PSelect
                :model-value="d.backup"
                :options="backupOptions"
                size="sm"
                :aria-label="t('admin.db.backupFor', { name: d.name })"
                @update:model-value="(b) => b && setBackup.mutate({ name: d.name, backup: b })"
              />
            </div>
            <div class="flex justify-end px-3.5 py-2">
              <PButton size="xs" @click="backupNow.mutate(d.name)">{{ t('admin.db.backupNow') }}</PButton>
            </div>
          </div>
        </div>
      </div>
    </AdminCard>
  </template>
</template>
