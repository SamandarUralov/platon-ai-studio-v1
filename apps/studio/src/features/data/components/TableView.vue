<script setup lang="ts">
/** One table: header + Records / Fields / Relationships / DDL / Diagram / SQL tabs. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Code2, GitFork, Link2, ListTree, Rows3, Terminal } from 'lucide-vue-next'
import { PTabs, type TabItem } from '@platon/ui'
import type { DbConnection, Table } from '@platon/definition'
import TableHeader from './TableHeader.vue'
import RecordsGrid from './RecordsGrid.vue'
import FieldsEditor from './FieldsEditor.vue'
import RelationshipsView from './RelationshipsView.vue'
import DdlView from './DdlView.vue'
import ErDiagram from './ErDiagram.vue'
import SqlConsole from './SqlConsole.vue'
import { relationsIn, relationsOut } from '../lib/model'
import { useData } from '../composables/useDataModel'

export type DataTab = 'records' | 'fields' | 'relationships' | 'ddl' | 'diagram' | 'sql'

const props = defineProps<{ table: Table; conn: DbConnection }>()
const tab = defineModel<DataTab>('tab', { required: true })
const selected = defineModel<string | null>('selected', { default: null })
const sql = defineModel<string>('sql', { default: '' })
const emit = defineEmits<{ openTable: [tableId: string]; openConn: []; deleted: [] }>()
const { t } = useI18n()
const m = useData()
const fieldsEditor = ref<InstanceType<typeof FieldsEditor>>()

const relCount = computed(
  () => relationsOut(props.table, m.tables.value).length + relationsIn(props.table, m.tables.value).length,
)
const problems = computed(
  () => m.def.problems.filter((p) => p.path?.startsWith(`/data/tables/${props.table.id}/`)).length,
)
const tabs = computed<TabItem<DataTab>[]>(() => [
  { value: 'records', label: t('data.tabs.records'), icon: Rows3 },
  {
    value: 'fields',
    label: t('data.tabs.fields'),
    icon: ListTree,
    count: problems.value || props.table.fields.length,
    tone: problems.value ? 'danger' : undefined,
  },
  { value: 'relationships', label: t('data.tabs.relationships'), icon: Link2, count: relCount.value },
  { value: 'ddl', label: t('data.tabs.ddl'), icon: Code2 },
  { value: 'diagram', label: t('data.tabs.diagram'), icon: GitFork },
  { value: 'sql', label: t('data.tabs.sql'), icon: Terminal },
])
const fill = computed(() => tab.value === 'records' || tab.value === 'diagram')

function openSql(text: string) {
  sql.value = text
  tab.value = 'sql'
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 px-6 pt-4">
      <TableHeader
        :table="table"
        :conn="conn"
        @tab="(v) => (tab = v)"
        @open-conn="emit('openConn')"
        @deleted="emit('deleted')"
      />
      <PTabs v-model="tab" :items="tabs" class="mt-3" />
    </div>
    <div :class="['min-h-0 flex-1 px-6 pb-6 pt-4', fill ? 'flex flex-col' : 'scroll-thin overflow-auto']">
      <RecordsGrid v-if="tab === 'records'" :table="table" />
      <FieldsEditor
        v-else-if="tab === 'fields'"
        ref="fieldsEditor"
        v-model:selected="selected"
        :table="table"
      />
      <RelationshipsView
        v-else-if="tab === 'relationships'"
        :table="table"
        @open="(id) => emit('openTable', id)"
      />
      <DdlView v-else-if="tab === 'ddl'" :table="table" :conn="conn" @open-sql="openSql" />
      <ErDiagram
        v-else-if="tab === 'diagram'"
        :conn="conn"
        :active-id="table.id"
        @open="(id) => emit('openTable', id)"
      />
      <SqlConsole v-else-if="tab === 'sql'" v-model="sql" :conn="conn" :table="table" />
    </div>
  </div>
</template>
