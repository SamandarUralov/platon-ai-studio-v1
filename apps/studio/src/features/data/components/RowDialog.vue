<script setup lang="ts">
/** Add or edit one Development record. Inputs follow the field type. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Rows3 } from 'lucide-vue-next'
import {
  PButton,
  PCheckbox,
  PCombobox,
  PDialog,
  PField,
  PInput,
  PSelect,
  PSwitch,
  PTextarea,
  toast,
} from '@platon/ui'
import type { DataRow, Table, TableField } from '@platon/definition'
import { ApiError, errorMessage } from '@/services/http'
import { dataApi, dataKeys } from '../api'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ table: Table; row: DataRow | null }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const m = useData()
const qc = useQueryClient()
const values = ref<Record<string, unknown>>({})
const errors = ref<Record<string, string>>({})

watch(
  () => [open.value, props.row] as const,
  ([o, r]) => {
    if (!o) return
    errors.value = {}
    values.value = r
      ? { ...r }
      : Object.fromEntries(props.table.fields.map((f) => [f.key, f.type === 'checkbox' ? false : '']))
  },
  { immediate: true },
)

// Link pickers: display values of the target tables (first field), loaded once per dialog.
const linkTargets = computed(() => [
  ...new Set(props.table.fields.filter((f) => f.type === 'link' && f.link).map((f) => f.link!)),
])
const linkOptions = useQuery({
  queryKey: computed(() => ['data', m.pid.value, 'link-options', linkTargets.value]),
  enabled: computed(() => open.value && linkTargets.value.length > 0),
  queryFn: async () => {
    const out: Record<string, { value: string; label: string }[]> = {}
    for (const id of linkTargets.value) {
      const target = m.tables.value.find((x) => x.id === id)
      const first = target?.fields[0]?.key
      const rows = await dataApi.rows(m.pid.value, id, { limit: 200 })
      out[id] = [...new Set(rows.items.map((r) => String((first && r[first]) ?? r.id)))].map((v) => ({
        value: v,
        label: v,
      }))
    }
    return out
  },
})

const str = (k: string) => String(values.value[k] ?? '')
const options = (f: TableField) =>
  (f.type === 'workflow_state' && f.workflow ? m.workflowStates(f.workflow) : (f.options ?? [])).map((o) => ({
    value: o,
    label: o,
  }))
const multi = (f: TableField) =>
  new Set(
    str(f.key)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
function toggleMulti(f: TableField, o: string, on: boolean | 'indeterminate') {
  const s = multi(f)
  if (on === true) s.add(o)
  else s.delete(o)
  values.value[f.key] = (f.options ?? []).filter((x) => s.has(x)).join(', ')
}

const save = useMutation({
  mutationFn: () => {
    const v = Object.fromEntries(
      props.table.fields.filter((f) => f.type !== 'auto_number').map((f) => [f.key, values.value[f.key]]),
    )
    return props.row
      ? dataApi.updateRow(m.pid.value, props.table.id, props.row.id, v)
      : dataApi.createRow(m.pid.value, props.table.id, v)
  },
  onSuccess: () => {
    void qc.invalidateQueries({ queryKey: dataKeys.all(m.pid.value) })
    toast(props.row ? t('data.records.saved') : t('data.records.created'), { tone: 'ok' })
    open.value = false
  },
  onError: (e) => {
    if (e instanceof ApiError && e.details?.length)
      errors.value = Object.fromEntries(e.details.filter((d) => d.path).map((d) => [d.path!, d.problem]))
    toast(errorMessage(e), { tone: 'danger' })
  },
})
</script>

<template>
  <PDialog
    v-model:open="open"
    :icon="Rows3"
    :width="560"
    :title="row ? t('data.records.edit') : t('data.records.new')"
    :description="`${table.name} · ${t('data.envs.development')}`"
  >
    <form id="row-form" class="grid grid-cols-2 gap-3" @submit.prevent="save.mutate()">
      <PField
        v-for="f in table.fields"
        :key="f.key"
        v-slot="{ id }"
        :label="f.name"
        :required="f.req"
        :error="errors[f.key] ? `${f.name} is ${errors[f.key]}` : null"
        :class="f.type === 'long_text' || f.type === 'json' || f.type === 'multi_select' ? 'col-span-2' : ''"
      >
        <PInput
          v-if="f.type === 'auto_number'"
          :id="id"
          :model-value="row ? str(f.key) : ''"
          :placeholder="t('data.records.auto')"
          disabled
          mono
        />
        <PTextarea
          v-else-if="f.type === 'long_text' || f.type === 'json'"
          :id="id"
          v-model="values[f.key] as string"
          :rows="3"
        />
        <div v-else-if="f.type === 'checkbox'" class="flex h-[34px] items-center">
          <PSwitch v-model="values[f.key] as boolean" :label="f.name" />
        </div>
        <PSelect
          v-else-if="f.type === 'single_select' || f.type === 'workflow_state'"
          v-model="values[f.key] as string"
          :options="options(f)"
          :placeholder="t('data.records.pick')"
          :aria-label="f.name"
        />
        <div v-else-if="f.type === 'multi_select'" class="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          <PCheckbox
            v-for="o in f.options ?? []"
            :key="o"
            :label="o"
            :model-value="multi(f).has(o)"
            @update:model-value="(v) => toggleMulti(f, o, v)"
          />
        </div>
        <PCombobox
          v-else-if="f.type === 'link'"
          v-model="values[f.key] as string"
          :options="linkOptions.data.value?.[f.link ?? ''] ?? []"
          :placeholder="t('data.records.pick')"
        />
        <PInput
          v-else-if="f.type === 'file'"
          :id="id"
          :model-value="str(f.key)"
          :placeholder="t('data.records.fileHint')"
          disabled
        />
        <PInput
          v-else
          :id="id"
          v-model="values[f.key] as string"
          :type="
            f.type === 'date'
              ? 'date'
              : f.type === 'datetime'
                ? 'datetime-local'
                : f.type === 'user_account'
                  ? 'email'
                  : 'text'
          "
          :inputmode="f.type === 'number' || f.type === 'currency' ? 'decimal' : undefined"
          :invalid="!!errors[f.key]"
        />
      </PField>
    </form>
    <template #footer="{ close }">
      <PButton @click="close">{{ t('data.fields.cancel') }}</PButton>
      <PButton variant="primary" type="submit" form="row-form" :loading="save.isPending.value">{{
        row ? t('data.records.save') : t('data.records.add')
      }}</PButton>
    </template>
  </PDialog>
</template>
