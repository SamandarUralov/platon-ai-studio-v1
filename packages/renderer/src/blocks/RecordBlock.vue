<script setup lang="ts">
/** Form, record details and list — all read fields of one table. */
import { computed, reactive } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import type { TableField } from '@platon/definition'
import { type BlockProps, CARD, FIELD, str, tr, useResolved } from './props'
import { useRows } from './useRows'
import { columnLabel, fieldOf, formatCell } from '../format'
import { toneClass } from '../theme'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const { table, columns, rows, loaded } = useRows(props, r)
const fields = computed(() =>
  columns.value.map((k) => ({ key: k, label: columnLabel(table.value, k), field: fieldOf(table.value, k) })),
)
const values = reactive<Record<string, string>>({})

function inputType(f: TableField | undefined): string {
  if (!f) return 'text'
  return (
    (
      { number: 'number', currency: 'number', date: 'date', datetime: 'datetime-local' } as Record<
        string,
        string
      >
    )[f.type] ?? 'text'
  )
}
function placeholder(f: TableField | undefined, label: string): string {
  if (f?.type === 'link') return `Choose ${label.toLowerCase()}…`
  if (f?.type === 'workflow_state' || f?.type === 'single_select') return 'Select…'
  return f?.type === 'date' ? 'mm/dd/yyyy' : ''
}
function options(f: TableField | undefined): string[] {
  if (!f) return []
  if (f.options?.length) return f.options
  if (f.type === 'workflow_state')
    return props.ctx.definition.workflows.find((w) => w.id === f.workflow)?.states.map((s) => s.name) ?? []
  if (f.type === 'link')
    return (props.ctx.records[f.link ?? ''] ?? []).map((x) => str(x.name ?? x.ref ?? x.id))
  return []
}
function change(key: string, v: string) {
  values[key] = v
  emit('event', 'change', { field: key, value: v })
}
function submit() {
  emit('event', 'submit', { ...values })
}
const record = computed(() => rows.value[0])
const listItems = computed(() =>
  rows.value.slice(0, 12).map((row) => ({
    row,
    title: str(row[columns.value[0] ?? 'id']),
    meta: fields.value.slice(1).map((c) => formatCell(props.ctx.definition, c.field, row[c.key])),
  })),
)
</script>

<template>
  <!-- form -->
  <form v-if="block.type === 'form'" :class="CARD" class="p-5" @submit.prevent="submit">
    <div v-if="r.title" class="mb-4 text-[14px] font-bold">{{ tr(props, 'title', r.title) }}</div>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-3.5">
      <label v-for="c in fields" :key="c.key" class="block min-w-0">
        <span class="mb-1.5 block text-[12.5px] font-semibold text-(--app-fg-2)"
          >{{ c.label }}<span v-if="c.field?.req" class="text-(--app-danger-fg)"> *</span></span
        >
        <select
          v-if="options(c.field).length"
          :class="FIELD"
          :disabled="ctx.design || r.disabled === true"
          :value="values[c.key] ?? ''"
          @change="change(c.key, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ placeholder(c.field, c.label) || 'Select…' }}</option>
          <option v-for="o in options(c.field)" :key="o" :value="o">{{ o }}</option>
        </select>
        <input
          v-else
          :class="FIELD"
          :type="inputType(c.field)"
          :placeholder="placeholder(c.field, c.label)"
          :disabled="ctx.design || r.disabled === true"
          :value="values[c.key] ?? ''"
          @input="change(c.key, ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>
    <div class="mt-5 flex justify-end">
      <button
        type="submit"
        :disabled="ctx.design || r.disabled === true"
        class="h-9 rounded-(--app-radius) bg-(--app-accent) px-4 text-[13px] font-bold text-(--app-accent-fg) hover:opacity-90"
      >
        {{ tr(props, 'submitLabel', str(r.submitLabel, 'Save')) }}
      </button>
    </div>
  </form>

  <!-- details -->
  <div v-else-if="block.type === 'detail'" :class="CARD" class="p-5">
    <div v-if="r.title" class="mb-3 text-[14px] font-bold">{{ tr(props, 'title', r.title) }}</div>
    <dl class="m-0 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-4 gap-y-3">
      <div v-for="c in fields" :key="c.key" class="min-w-0">
        <dt class="text-[12px] text-(--app-muted)">{{ c.label }}</dt>
        <dd class="m-0 mt-0.5 truncate text-[13.5px] font-medium">
          <template v-if="record">
            <span
              v-if="formatCell(ctx.definition, c.field, record[c.key]).tone"
              class="inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
              :class="toneClass(formatCell(ctx.definition, c.field, record[c.key]).tone)"
              >{{ formatCell(ctx.definition, c.field, record[c.key]).text }}</span
            >
            <template v-else>{{ formatCell(ctx.definition, c.field, record[c.key]).text }}</template>
          </template>
          <span v-else class="text-(--app-faint)">—</span>
        </dd>
      </div>
    </dl>
  </div>

  <!-- list -->
  <div v-else :class="CARD" class="overflow-hidden">
    <div v-if="r.title" class="border-b border-(--app-line) px-4 py-3 text-[14px] font-bold">
      {{ tr(props, 'title', r.title) }}
    </div>
    <template v-if="loaded">
      <button
        v-for="(it, i) in listItems"
        :key="str(it.row.id, String(i))"
        type="button"
        class="flex w-full items-center gap-3 border-b border-(--app-line-soft) px-4 py-3 text-left last:border-b-0 hover:bg-(--app-hover)"
        @click.stop="emit('event', 'rowClick', it.row)"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[13.5px] font-semibold">{{ it.title }}</span>
          <span class="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-(--app-muted)">
            <template v-for="(m, j) in it.meta" :key="j">
              <span
                v-if="m.tone"
                class="rounded-full px-1.5 text-[11px] font-semibold"
                :class="toneClass(m.tone)"
                >{{ m.text }}</span
              >
              <span v-else>{{ m.text }}</span>
            </template>
          </span>
        </span>
        <ChevronRight :size="15" class="text-(--app-faint)" />
      </button>
      <div v-if="!listItems.length" class="px-4 py-8 text-center text-[12.5px] text-(--app-faint)">
        No records to show for this user.
      </div>
    </template>
    <div v-else class="space-y-2 p-4">
      <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-(--app-radius) bg-(--app-subtle)" />
    </div>
  </div>
</template>
