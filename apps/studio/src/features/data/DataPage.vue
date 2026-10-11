<script setup lang="ts">
/**
 * Data layer (requirements §3.4): connections and their tables on the left, connection or table
 * workspace in the centre, Data AI / field inspector on the right. Route: data/:connId?/:tableId?
 */
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Database, PanelRightClose, Plus, Sparkles, TableProperties } from 'lucide-vue-next'
import { PButton, PEmptyState } from '@platon/ui'
import LayerShell from '@/components/shell/LayerShell.vue'
import PanelHeader from '@/components/shell/PanelHeader.vue'
import AiPanel from '@/features/ai/AiPanel.vue'
import type { AiContext } from '@/features/ai/types'
import { projectLinks } from '@/composables/useProject'
import { useUiStore } from '@/stores/ui'
import ConnectionList from './components/ConnectionList.vue'
import ConnectionView from './components/ConnectionView.vue'
import TableView, { type DataTab } from './components/TableView.vue'
import FieldInspector from './components/FieldInspector.vue'
import NewDatabaseDialog from './components/NewDatabaseDialog.vue'
import NewTableDialog from './components/NewTableDialog.vue'
import { provideDataModel } from './composables/useDataModel'
import HideLeftPanel from '@/components/shell/HideLeftPanel.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const ui = useUiStore()
const m = provideDataModel()
const links = computed(() => projectLinks(m.pid.value))

const connId = computed(() => (route.params.connId ? String(route.params.connId) : undefined))
const tableId = computed(() => (route.params.tableId ? String(route.params.tableId) : undefined))
const conn = computed(() => m.connections.value.find((c) => c.id === connId.value))
const table = computed(() => m.tables.value.find((x) => x.id === tableId.value))
const tableConn = computed(() => m.connOf(table.value))

const TABS: DataTab[] = ['records', 'fields', 'relationships', 'ddl', 'diagram', 'sql']
const tab = computed<DataTab>({
  get: () => (TABS.includes(route.query.tab as DataTab) ? (route.query.tab as DataTab) : 'records'),
  set: (v) => void router.replace({ query: { ...route.query, tab: v === 'records' ? undefined : v } }),
})

function openTable(cid: string, tid: string, keepTab = true) {
  void router.push({
    ...links.value.data(cid, tid),
    query: keepTab && route.query.tab ? { tab: route.query.tab } : {},
  })
}
const openTableById = (tid: string) => {
  const tb = m.tables.value.find((x) => x.id === tid)
  if (tb) openTable(tb.connection, tb.id)
}
const openConn = (cid: string) => void router.push(links.value.data(cid))

// No selection → open the first table (or the first connection when it has none).
watchEffect(() => {
  if (!m.def.ready || connId.value) return
  const first = m.connections.value[0]
  if (!first) return
  const tb = m.tablesOf(first.id)[0]
  void router.replace(tb ? links.value.data(first.id, tb.id) : links.value.data(first.id))
})
// A table opened under the wrong connection id (e.g. an old link) is redirected to its own.
watchEffect(() => {
  if (table.value && connId.value && table.value.connection !== connId.value)
    void router.replace({ ...links.value.data(table.value.connection, table.value.id), query: route.query })
})

// ── field inspector selection (per table)
const selectedField = ref<string | null>(null)
watch(tableId, () => (selectedField.value = null))
const field = computed(() =>
  tab.value === 'fields' ? table.value?.fields.find((f) => f.key === selectedField.value) : undefined,
)
watch(field, (f) => {
  if (f) ui.rightOpen = true
})

// ── SQL text per table, kept while switching tabs
const sqlByTable = ref<Record<string, string>>({})
const sql = computed({
  get: () => (tableId.value ? (sqlByTable.value[tableId.value] ?? '') : ''),
  set: (v: string) => tableId.value && (sqlByTable.value = { ...sqlByTable.value, [tableId.value]: v }),
})

// ── dialogs
const newDbOpen = ref(false)
const newTableOpen = ref(false)
const newTableConn = ref<string | null>(null)
function newTable(cid?: string) {
  newTableConn.value = cid ?? connId.value ?? null
  newTableOpen.value = true
}

const aiContext = computed<AiContext | null>(() =>
  table.value
    ? { kind: 'table', path: `/data/tables/${table.value.id}`, label: table.value.name }
    : conn.value
      ? { kind: 'connection', path: `/data/connections/${conn.value.id}`, label: conn.value.name }
      : null,
)
</script>

<template>
  <LayerShell>
    <template #left>
      <PanelHeader
        :title="t('data.title')"
        :sub="t('data.summary', { c: m.connections.value.length, t: m.tables.value.length })"
        ><HideLeftPanel
      /></PanelHeader>
      <ConnectionList
        :conn-id="connId"
        :table-id="tableId"
        @open-conn="openConn"
        @open-table="(c, tb) => openTable(c, tb)"
        @new-db="newDbOpen = true"
        @new-table="newTable"
      />
    </template>
    <template #left-rail>
      <PButton
        square
        variant="ghost"
        :icon="Database"
        :label="t('data.newDatabase')"
        @click="newDbOpen = true"
      />
    </template>

    <TableView
      v-if="table && tableConn"
      v-model:tab="tab"
      v-model:selected="selectedField"
      v-model:sql="sql"
      :table="table"
      :conn="tableConn"
      @open-table="openTableById"
      @open-conn="openConn(tableConn.id)"
      @deleted="openConn(tableConn.id)"
    />
    <ConnectionView
      v-else-if="conn && !tableId"
      :conn="conn"
      @open-table="(tb) => openTable(conn!.id, tb, false)"
      @new-table="newTable(conn.id)"
      @detached="router.replace(links.data())"
    />
    <div v-else-if="m.def.ready" class="grid flex-1 place-items-center">
      <PEmptyState
        v-if="tableId"
        :icon="TableProperties"
        :title="t('data.table.notFound')"
        :description="`/data/tables/${tableId}`"
      >
        <PButton v-if="conn" @click="openConn(conn.id)">{{ conn.name }}</PButton>
      </PEmptyState>
      <PEmptyState
        v-else
        :icon="Database"
        :title="t('data.noDatabases')"
        :description="t('data.noDatabasesHint')"
      >
        <PButton variant="primary" :icon="Plus" @click="newDbOpen = true">{{
          t('data.newDatabase')
        }}</PButton>
      </PEmptyState>
    </div>

    <template #right="{ close }">
      <FieldInspector v-if="table && field" :table="table" :field="field" @close="selectedField = null" />
      <template v-else>
        <PanelHeader :title="t('data.ai')" :sub="aiContext?.label">
          <PButton
            square
            size="xs"
            variant="ghost"
            :icon="PanelRightClose"
            :label="t('data.hidePanel')"
            @click="close"
          />
        </PanelHeader>
        <AiPanel :context="aiContext" />
      </template>
    </template>
    <template #right-rail>
      <PButton square variant="ghost" :icon="Sparkles" :label="t('data.ai')" @click="ui.rightOpen = true" />
    </template>
  </LayerShell>

  <NewDatabaseDialog v-model:open="newDbOpen" @created="openConn" />
  <NewTableDialog
    v-model:open="newTableOpen"
    :conn-id="newTableConn"
    @created="(c, tb) => router.push({ ...links.data(c, tb), query: { tab: 'fields' } })"
  />
</template>
