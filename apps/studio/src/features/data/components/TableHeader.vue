<script setup lang="ts">
/** Table title, id path, structure / records / connection pills and table actions. */
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Database, Download, Ellipsis, Layers, Pencil, Trash2 } from 'lucide-vue-next'
import { PButton, PDialog, PIcon, PMenu, toast, toneClasses, type MenuEntry } from '@platon/ui'
import { ENGINES, type DbConnection, type Table } from '@platon/definition'
import { errorMessage } from '@/services/http'
import GenerateDataPopover from './GenerateDataPopover.vue'
import { dataApi } from '../api'
import { removeTableChange, renameTableChange, toCsv } from '../lib/model'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ table: Table; conn: DbConnection }>()
const emit = defineEmits<{ tab: [tab: 'fields' | 'records']; openConn: []; deleted: [] }>()
const { t } = useI18n()
const m = useData()
const eng = computed(() => ENGINES[props.conn.engine])
const count = computed(() => m.count(props.table.id))

const renaming = ref(false)
const nameInput = ref<HTMLInputElement>()
async function startRename() {
  renaming.value = true
  await nextTick()
  nameInput.value?.select()
}
function commitRename(e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  renaming.value = false
  if (v && v !== props.table.name) m.edit(renameTableChange(props.table, v))
}

const exporting = ref(false)
async function exportCsv() {
  exporting.value = true
  try {
    const rows = await dataApi.allRows(m.pid.value, props.table.id, { env: 'development' })
    const blob = new Blob([toCsv(props.table.fields, rows)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${props.table.id}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast(t('data.table.exported', { n: rows.length }), { tone: 'ok' })
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    exporting.value = false
  }
}

const confirmDelete = ref(false)
const menu = computed<MenuEntry[]>(() => [
  { label: t('data.table.rename'), icon: Pencil, onSelect: () => void startRename() },
  {
    label: t('data.table.copyId'),
    icon: Copy,
    onSelect: () => {
      void navigator.clipboard?.writeText(props.table.id)
      toast(t('data.table.copied'))
    },
  },
  { type: 'separator' },
  { label: t('data.table.delete'), icon: Trash2, danger: true, onSelect: () => (confirmDelete.value = true) },
])
function remove() {
  const name = props.table.name
  if (m.edit(removeTableChange(props.table), t('data.table.deleted', { name }))) {
    confirmDelete.value = false
    emit('deleted')
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <div class="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-bg text-teal">
      <PIcon :name="table.icon" :size="16" />
    </div>
    <div class="min-w-0">
      <input
        v-if="renaming"
        ref="nameInput"
        :value="table.name"
        class="h-7 rounded-md border border-primary bg-surface px-1.5 text-[19px] font-extrabold tracking-[-0.02em] outline-none"
        @blur="commitRename"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @keydown.esc="renaming = false"
      />
      <h1
        v-else
        class="m-0 cursor-text text-[19px] font-extrabold leading-tight tracking-[-0.02em]"
        :title="t('data.table.rename')"
        @dblclick="startRename"
      >
        {{ table.name }}
      </h1>
      <div class="mt-0.5 font-mono text-xs text-faint">/data/tables/{{ table.id }}</div>
    </div>
    <div class="ml-auto flex flex-wrap items-center gap-2">
      <GenerateDataPopover :table="table" />
      <PButton :icon="Download" :loading="exporting" @click="exportCsv">{{ t('data.table.export') }}</PButton>
      <PMenu :items="menu">
        <PButton square variant="ghost" :icon="Ellipsis" label="More" />
      </PMenu>
    </div>
  </div>
  <div class="mt-3 flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-primary-tint px-3 text-base font-bold text-primary-strong hover:bg-primary-soft"
      @click="emit('tab', 'fields')"
    >
      <Layers :size="15" />{{ t('data.table.structure') }} ·
      {{ t('data.table.fieldsN', { n: table.fields.length }) }}
    </button>
    <button
      type="button"
      class="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-teal-bg px-3 text-base font-bold text-teal hover:opacity-90"
      @click="emit('tab', 'records')"
    >
      <Database :size="15" />{{ t('data.table.recordsIn', { env: t('data.envs.development') }) }} ·
      {{ count ?? '…' }}
    </button>
    <button
      type="button"
      class="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-base font-semibold text-fg-2 hover:bg-hover"
      @click="emit('openConn')"
    >
      <PIcon :name="eng.icon" :size="14" :class="toneClasses[eng.tone].fg" />{{ conn.name }} · {{ eng.label }}
    </button>
  </div>
  <PDialog
    v-model:open="confirmDelete"
    :icon="Trash2"
    :width="440"
    :title="t('data.table.deleteTitle', { name: table.name })"
    :description="t('data.table.deleteBody')"
  >
    <template #footer="{ close }">
      <PButton @click="close">{{ t('data.fields.cancel') }}</PButton>
      <PButton variant="danger-solid" @click="remove">{{ t('data.table.delete') }}</PButton>
    </template>
  </PDialog>
</template>
