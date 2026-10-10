<script setup lang="ts">
/** Right-panel inspector for one field: all properties, including options, link target, workflow and storage. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, X } from 'lucide-vue-next'
import { PButton, PField, PInput, PSelect, PSwitch } from '@platon/ui'
import type { Table, TableField } from '@platon/definition'
import PanelHeader from '@/components/shell/PanelHeader.vue'
import { changeTypeChange, removeFieldChange, setFieldPropChange } from '../lib/model'
import { useData } from '../composables/useDataModel'
import { FIELD_TYPE_OPTIONS } from './fieldTypes'

const props = defineProps<{ table: Table; field: TableField }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const m = useData()
const newOption = ref('')

const tableOptions = computed(() => m.tables.value.map((x) => ({ value: x.id, label: x.name })))
const workflowOptions = computed(() =>
  (m.def.definition?.workflows ?? []).map((w) => ({ value: w.id, label: w.name })),
)
const storageOptions = computed(() =>
  (m.def.definition?.storage.object ?? []).map((s) => ({ value: s.id, label: s.name })),
)
const isSelect = computed(() => props.field.type === 'single_select' || props.field.type === 'multi_select')

function rename(e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  if (v && v !== props.field.name)
    m.edit(
      setFieldPropChange(
        props.table,
        props.field,
        'name',
        v,
        `Renamed field “${props.field.name}” to “${v}” in ${props.table.name}`,
      ),
    )
}
const setOptions = (opts: string[]) =>
  m.edit(
    setFieldPropChange(
      props.table,
      props.field,
      'options',
      opts,
      `Changed options of “${props.field.name}” in ${props.table.name}`,
    ),
  )
function addOption() {
  const v = newOption.value.trim()
  if (!v || props.field.options?.includes(v)) return
  setOptions([...(props.field.options ?? []), v])
  newOption.value = ''
}
function renameOption(i: number, e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  const opts = [...(props.field.options ?? [])]
  if (!v || opts[i] === v) return
  opts[i] = v
  setOptions(opts)
}
function remove() {
  if (
    m.edit(removeFieldChange(props.table, props.field), t('data.fields.deleted', { name: props.field.name }))
  )
    emit('close')
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <PanelHeader :title="field.name" :sub="`${t('data.fields.inspector')} · ${table.name}`">
      <PButton square size="xs" variant="ghost" :icon="X" label="Close" @click="emit('close')" />
    </PanelHeader>
    <div class="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
      <PField v-slot="{ id }" :label="t('data.fields.name')">
        <PInput :id="id" :key="field.key + field.name" :model-value="field.name" @change="rename" />
      </PField>
      <PField v-slot="{ id }" :label="t('data.fields.key')" :hint="t('data.fields.keyHint')">
        <PInput :id="id" :model-value="field.key" mono readonly />
      </PField>
      <PField :label="t('data.fields.type')">
        <PSelect
          :model-value="field.type"
          :options="FIELD_TYPE_OPTIONS"
          :aria-label="t('data.fields.type')"
          @update:model-value="
            (v) =>
              v &&
              v !== field.type &&
              m.edit(changeTypeChange(table, field, v, tableOptions.find((o) => o.value !== table.id)?.value))
          "
        />
      </PField>
      <div class="flex flex-col gap-2.5 rounded-xl border border-line-soft p-3">
        <PField inline :label="t('data.fields.required')">
          <PSwitch
            :model-value="!!field.req"
            :label="t('data.fields.required')"
            @update:model-value="(v) => m.edit(setFieldPropChange(table, field, 'req', v || undefined))"
          />
        </PField>
        <PField inline :label="t('data.fields.unique')">
          <PSwitch
            :model-value="!!field.unique"
            :label="t('data.fields.unique')"
            @update:model-value="(v) => m.edit(setFieldPropChange(table, field, 'unique', v || undefined))"
          />
        </PField>
      </div>
      <PField v-if="field.type === 'link'" :label="t('data.fields.linkTo')">
        <PSelect
          :model-value="field.link"
          :options="tableOptions"
          :aria-label="t('data.fields.linkTo')"
          @update:model-value="(v) => v && m.edit(setFieldPropChange(table, field, 'link', v))"
        />
      </PField>
      <PField v-if="field.type === 'workflow_state'" :label="t('data.fields.workflow')">
        <PSelect
          :model-value="field.workflow"
          :options="workflowOptions"
          :aria-label="t('data.fields.workflow')"
          @update:model-value="(v) => v && m.edit(setFieldPropChange(table, field, 'workflow', v))"
        />
      </PField>
      <PField v-if="field.type === 'file'" :label="t('data.fields.storage')">
        <PSelect
          :model-value="field.storage"
          :options="storageOptions"
          :aria-label="t('data.fields.storage')"
          @update:model-value="(v) => v && m.edit(setFieldPropChange(table, field, 'storage', v))"
        />
      </PField>
      <div v-if="isSelect">
        <div class="mb-1.5 text-sm font-semibold text-fg-2">{{ t('data.fields.options') }}</div>
        <div class="flex flex-col gap-1.5">
          <div v-for="(o, i) in field.options ?? []" :key="o" class="flex items-center gap-1.5">
            <PInput :model-value="o" size="sm" class="flex-1" @change="renameOption(i, $event)" />
            <PButton
              square
              size="xs"
              variant="ghost"
              :icon="X"
              :label="o"
              @click="setOptions((field.options ?? []).filter((x) => x !== o))"
            />
          </div>
          <form class="flex items-center gap-1.5" @submit.prevent="addOption">
            <PInput v-model="newOption" size="sm" class="flex-1" :placeholder="t('data.fields.addOption')" />
            <PButton
              square
              size="xs"
              variant="tint"
              :icon="Plus"
              :label="t('data.fields.addOption')"
              type="submit"
            />
          </form>
        </div>
      </div>
      <PButton variant="danger" :icon="Trash2" class="mt-auto self-start" @click="remove">{{
        t('data.fields.delete')
      }}</PButton>
    </div>
  </div>
</template>
