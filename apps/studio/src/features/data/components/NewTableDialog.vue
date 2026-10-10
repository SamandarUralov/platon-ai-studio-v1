<script setup lang="ts">
/** New table / collection / key set. Name → stable snake_case id; Redis asks for value type and TTL. */
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Layers, Plus, Table2, X } from 'lucide-vue-next'
import { PButton, PCheckbox, PDialog, PField, PIcon, PInput, PSelect, type SelectOption } from '@platon/ui'
import {
  ENGINES,
  snake,
  uniqueName,
  type Table,
  type TableField,
  type TableFieldType,
} from '@platon/definition'
import {
  addTableChange,
  defaultIcon,
  physicalNameOf,
  REDIS_TTLS,
  REDIS_VALUE_TYPES,
  TABLE_ICONS,
} from '../lib/model'
import { useData } from '../composables/useDataModel'
import { FIELD_TYPE_OPTIONS } from './fieldTypes'

const props = defineProps<{ connId: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [connId: string, tableId: string] }>()
const { t } = useI18n()
const m = useData()

interface DraftField {
  uid: number
  name: string
  type: TableFieldType
  req: boolean
}
let uid = 0
const blankField = (): DraftField => ({ uid: ++uid, name: '', type: 'text', req: false })
const form = reactive({
  name: '',
  conn: '',
  icon: 'table-2',
  iconTouched: false,
  vtype: 'Hash' as string,
  ttl: '1 day' as string,
  fields: [blankField(), blankField()] as DraftField[],
})
const error = ref<string | null>(null)

const conn = computed(() => m.connections.value.find((c) => c.id === form.conn))
const eng = computed(() => (conn.value ? ENGINES[conn.value.engine] : ENGINES.postgres))
const isRedis = computed(() => conn.value?.engine === 'redis')
const id = computed(() =>
  uniqueName(
    snake(form.name) || 'table',
    m.tables.value.map((x) => x.id),
  ),
)
const phys = computed(() => (conn.value ? physicalNameOf(conn.value, form.name, m.appSlug.value) : ''))
const connOptions = computed<SelectOption<string>[]>(() =>
  m.connections.value.map((c) => ({ value: c.id, label: `${c.name} · ${ENGINES[c.engine].label}` })),
)
const ttlOptions = REDIS_TTLS.map((v) => ({ value: v, label: v }))
const vtypeOptions = REDIS_VALUE_TYPES.map((v) => ({ value: v, label: v }))

watch(open, (o) => {
  if (!o) return
  Object.assign(form, {
    name: '',
    conn: props.connId ?? m.connections.value[0]?.id ?? '',
    iconTouched: false,
    vtype: 'Hash',
    ttl: '1 day',
    fields: [blankField(), blankField()],
  })
  error.value = null
})
watch(
  () => conn.value?.engine,
  (e) => {
    if (e && !form.iconTouched) form.icon = defaultIcon(e)
  },
  { immediate: true },
)

function create() {
  const name = form.name.trim()
  if (!name || !conn.value) return (error.value = t('data.newTable.needName'))
  const fields: TableField[] = isRedis.value
    ? [
        { key: 'key', name: 'Key', type: 'text', req: true },
        { key: 'value', name: `Value (${form.vtype})`, type: 'text' },
        { key: 'ttl', name: 'Expires in', type: 'text' },
      ]
    : [{ key: 'ref', name: '#', type: 'auto_number' }]
  if (!isRedis.value)
    for (const f of form.fields) {
      const n = f.name.trim()
      if (!n) continue
      const key = uniqueName(
        snake(n) || 'field',
        fields.map((x) => x.key),
      )
      const field: TableField = { key, name: n, type: f.type }
      if (f.req) field.req = true
      if (f.type === 'single_select' || f.type === 'multi_select') field.options = ['Option 1', 'Option 2']
      if (f.type === 'link') field.link = m.tablesOf(conn.value.id)[0]?.id ?? id.value
      fields.push(field)
    }
  const table: Table = {
    id: id.value,
    name,
    icon: form.icon,
    connection: conn.value.id,
    physicalName: phys.value,
    fields,
  }
  if (isRedis.value && form.ttl !== 'No expiry') table.ttl = form.ttl
  if (
    m.edit(
      addTableChange(table, conn.value.name),
      t('data.newTable.created', { name, conn: conn.value.name }),
    )
  ) {
    open.value = false
    emit('created', conn.value.id, table.id)
  }
}
</script>

<template>
  <PDialog
    v-model:open="open"
    :icon="Table2"
    :width="600"
    :title="t('data.newTable.title', { unit: eng.unit })"
    :description="conn ? `${conn.name} · ${eng.label}` : undefined"
  >
    <form id="new-table" class="flex flex-col gap-3.5" @submit.prevent="create">
      <div class="grid grid-cols-2 gap-2.5">
        <PField v-slot="{ id: fid }" :label="t('data.newTable.name')" required :error="error">
          <PInput :id="fid" v-model="form.name" :placeholder="t('data.newTable.namePh')" autofocus />
        </PField>
        <PField :label="t('data.newTable.database')">
          <PSelect v-model="form.conn" :options="connOptions" :aria-label="t('data.newTable.database')" />
        </PField>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-faint">
        <span
          >{{ t('data.newTable.id') }}: <b class="font-semibold text-fg-2">{{ id }}</b></span
        >
        <span>{{ t('data.newTable.storedAs', { name: phys }) }}</span>
      </div>
      <PField :label="t('data.newTable.icon')">
        <div role="radiogroup" :aria-label="t('data.newTable.icon')" class="flex flex-wrap gap-1">
          <button
            v-for="ic in TABLE_ICONS"
            :key="ic"
            type="button"
            role="radio"
            :aria-checked="form.icon === ic"
            :aria-label="ic"
            class="grid size-8 place-items-center rounded-lg border"
            :class="
              form.icon === ic
                ? 'border-primary bg-primary-tint text-primary-strong'
                : 'border-transparent text-muted hover:bg-hover'
            "
            @click="((form.icon = ic), (form.iconTouched = true))"
          >
            <PIcon :name="ic" :size="15" />
          </button>
        </div>
      </PField>
      <div v-if="isRedis" class="grid grid-cols-2 gap-2.5">
        <PField :label="t('data.newTable.valueType')">
          <PSelect v-model="form.vtype" :options="vtypeOptions" :aria-label="t('data.newTable.valueType')" />
        </PField>
        <PField :label="t('data.newTable.ttl')">
          <PSelect v-model="form.ttl" :options="ttlOptions" :aria-label="t('data.newTable.ttl')" />
        </PField>
      </div>
      <div v-else>
        <div class="mb-2 flex items-baseline gap-2">
          <span class="text-sm font-semibold text-fg-2">{{ t('data.newTable.fieldsTitle') }}</span>
          <span class="text-xs text-faint">{{ t('data.newTable.fieldsHint') }}</span>
        </div>
        <div class="flex flex-col gap-1.5">
          <div v-for="(f, i) in form.fields" :key="f.uid" class="flex items-center gap-1.5">
            <PInput
              v-model="f.name"
              size="sm"
              class="flex-1"
              :placeholder="t('data.newTable.fieldName')"
              :aria-label="t('data.newTable.fieldName')"
            />
            <PSelect
              v-model="f.type"
              :options="FIELD_TYPE_OPTIONS"
              size="sm"
              class="w-[150px]"
              :aria-label="t('data.fields.type')"
            />
            <PCheckbox v-model="f.req" :label="t('data.newTable.req')" />
            <PButton
              square
              size="xs"
              variant="ghost"
              :icon="X"
              label="Remove"
              @click="form.fields.splice(i, 1)"
            />
          </div>
        </div>
        <PButton
          size="xs"
          variant="ghost"
          :icon="Plus"
          class="mt-2 border border-dashed border-line"
          @click="form.fields.push(blankField())"
          >{{ t('data.newTable.addField') }}</PButton
        >
      </div>
      <div class="flex gap-2 rounded-[10px] bg-ok-bg px-3 py-2.5 text-sm leading-snug text-ok">
        <Layers :size="14" class="mt-0.5 shrink-0" />{{ t('data.newTable.desc') }}
      </div>
    </form>
    <template #footer="{ close }">
      <PButton @click="close">{{ t('data.fields.cancel') }}</PButton>
      <PButton variant="primary" type="submit" form="new-table" :disabled="!form.name.trim() || !conn">{{
        t('data.newTable.create', { unit: eng.unit })
      }}</PButton>
    </template>
  </PDialog>
</template>
