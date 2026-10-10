<script setup lang="ts">
/**
 * Records browser: server-side search / sort / paging, virtualised rows (NFR: big tables stay at 60 fps).
 * Only Development is editable; Staging and Production are read-only views of their own records.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { refDebounced } from '@vueuse/core'
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { ArrowDown, ArrowUp, Ellipsis, Lock, Pencil, Plus, Search, Trash2, Rows3 } from 'lucide-vue-next'
import {
  PBadge,
  PButton,
  PDialog,
  PEmptyState,
  PIcon,
  PInput,
  PMenu,
  PSegmented,
  PSpinner,
  toast,
  type MenuEntry,
} from '@platon/ui'
import {
  FIELD_TYPES,
  type DataRow,
  type Table,
  type TableField,
  type TableFieldType,
} from '@platon/definition'
import { errorMessage } from '@/services/http'
import RowDialog from './RowDialog.vue'
import RecordCell from './RecordCell.vue'
import { dataApi, dataKeys } from '../api'
import { ENV_NAMES, type Env } from '../lib/model'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ table: Table }>()
const { t } = useI18n()
const m = useData()
const qc = useQueryClient()
const PAGE = 100
const ROW_H = 38

const env = ref<Env>('development')
const search = ref('')
const q = refDebounced(search, 250)
const sort = ref<{ key: string; dir: 'asc' | 'desc' } | null>(null)
const editable = computed(() => env.value === 'development')
watch(
  () => props.table.id,
  () => {
    search.value = ''
    sort.value = null
  },
)

const rows = useInfiniteQuery({
  queryKey: computed(() => [
    ...dataKeys.rows(m.pid.value, props.table.id),
    { env: env.value, q: q.value, sort: sort.value },
  ]),
  queryFn: ({ pageParam }) =>
    dataApi.rows(m.pid.value, props.table.id, {
      env: env.value,
      offset: pageParam,
      limit: PAGE,
      q: q.value || undefined,
      sort: sort.value?.key,
      dir: sort.value?.dir,
    }),
  initialPageParam: 0,
  getNextPageParam: (last) =>
    last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
  placeholderData: keepPreviousData,
})
const items = computed<DataRow[]>(() => rows.data.value?.pages.flatMap((p) => p.items) ?? [])
const total = computed(() => rows.data.value?.pages[0]?.total ?? 0)

const WIDTH: Partial<Record<TableFieldType, number>> = {
  auto_number: 110,
  number: 120,
  currency: 120,
  checkbox: 96,
  date: 130,
  datetime: 180,
  single_select: 150,
  workflow_state: 160,
  long_text: 280,
  link: 190,
  file: 130,
  multi_select: 220,
  json: 200,
}
const cols = computed(() => props.table.fields.map((f) => ({ f, w: WIDTH[f.type] ?? 200 })))
const template = computed(() => `${cols.value.map((c) => `minmax(${c.w}px, 1fr)`).join(' ')} 44px`)
const minWidth = computed(() => cols.value.reduce((a, c) => a + c.w, 44))

const scroller = ref<HTMLElement | null>(null)
const virtualizer = useVirtualizer(
  computed(() => ({
    count: items.value.length + (rows.hasNextPage.value ? 1 : 0),
    getScrollElement: () => scroller.value,
    estimateSize: () => ROW_H,
    overscan: 12,
  })),
)
const virtualRows = computed(() => virtualizer.value.getVirtualItems())
watch(virtualRows, (vr) => {
  const last = vr.at(-1)
  if (
    last &&
    last.index >= items.value.length - 1 &&
    rows.hasNextPage.value &&
    !rows.isFetchingNextPage.value
  )
    void rows.fetchNextPage()
})

function toggleSort(f: TableField) {
  const s = sort.value
  sort.value =
    s?.key !== f.key ? { key: f.key, dir: 'asc' } : s.dir === 'asc' ? { key: f.key, dir: 'desc' } : null
}

// ── edit / delete
const dialogOpen = ref(false)
const editing = ref<DataRow | null>(null)
function openRow(r: DataRow | null) {
  if (!editable.value) return
  editing.value = r
  dialogOpen.value = true
}
const deleting = ref<DataRow | null>(null)
const del = useMutation({
  mutationFn: (r: DataRow) => dataApi.deleteRow(m.pid.value, props.table.id, r.id),
  onSuccess: () => {
    deleting.value = null
    void qc.invalidateQueries({ queryKey: dataKeys.all(m.pid.value) })
    toast(t('data.records.deleted'))
  },
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
})
const rowMenu = (r: DataRow): MenuEntry[] => [
  { label: t('data.records.edit'), icon: Pencil, onSelect: () => openRow(r) },
  { label: t('data.records.delete'), icon: Trash2, danger: true, onSelect: () => (deleting.value = r) },
]
const envOptions = computed(() => ENV_NAMES.map((e) => ({ value: e, label: t(`data.envs.${e}`) })))
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <PInput
        v-model="search"
        :icon="Search"
        size="sm"
        :placeholder="t('data.records.search')"
        class="min-w-[160px] max-w-[260px] flex-1"
        :aria-label="t('data.records.search')"
      />
      <PSegmented v-model="env" :options="envOptions" :aria-label="t('data.conn.credentials')" />
      <span class="text-sm text-muted">
        {{ t('data.records.count', { n: total })
        }}<template v-if="editable && m.testCount(table.id)">
          · {{ t('data.records.testCount', { n: m.testCount(table.id) }) }}</template
        >
      </span>
      <PSpinner
        v-if="rows.isFetching.value && !rows.isFetchingNextPage.value"
        :size="13"
        class="text-faint"
      />
      <span v-if="!editable" class="ml-auto inline-flex items-center gap-1.5 text-sm text-muted"
        ><Lock :size="13" />{{ t('data.records.readOnly') }}</span
      >
      <PButton v-else variant="primary" :icon="Plus" class="ml-auto" @click="openRow(null)">{{
        t('data.records.add')
      }}</PButton>
    </div>

    <div
      ref="scroller"
      class="scroll-thin relative min-h-[240px] flex-1 overflow-auto rounded-xl border border-line-2 bg-surface"
      role="grid"
      :aria-rowcount="total + 1"
    >
      <div :style="{ minWidth: `${minWidth}px` }">
        <div
          role="row"
          class="sticky top-0 z-10 grid border-b border-line-soft bg-subtle-2"
          :style="{ gridTemplateColumns: template }"
        >
          <button
            v-for="c in cols"
            :key="c.f.key"
            type="button"
            role="columnheader"
            :aria-sort="sort?.key === c.f.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'"
            class="flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-left text-xs font-semibold text-muted hover:text-fg"
            @click="toggleSort(c.f)"
          >
            <PIcon :name="FIELD_TYPES[c.f.type].icon" :size="12" class="opacity-70" />
            <span class="truncate">{{ c.f.name }}</span>
            <ArrowUp v-if="sort?.key === c.f.key && sort.dir === 'asc'" :size="12" class="text-primary" />
            <ArrowDown v-else-if="sort?.key === c.f.key" :size="12" class="text-primary" />
          </button>
          <span />
        </div>

        <div v-if="items.length" class="relative" :style="{ height: `${virtualizer.getTotalSize()}px` }">
          <div
            v-for="vr in virtualRows"
            :key="String(vr.key)"
            role="row"
            class="group absolute left-0 grid w-full border-b border-line-faint text-base hover:bg-hover"
            :class="[editable ? 'cursor-pointer' : '', items[vr.index]?._test ? 'bg-ai-bg/30' : '']"
            :style="{
              height: `${ROW_H}px`,
              transform: `translateY(${vr.start}px)`,
              gridTemplateColumns: template,
            }"
            :tabindex="editable && items[vr.index] ? 0 : -1"
            @click="items[vr.index] && openRow(items[vr.index]!)"
            @keydown.enter="items[vr.index] && openRow(items[vr.index]!)"
          >
            <template v-if="items[vr.index]">
              <div
                v-for="(c, ci) in cols"
                :key="c.f.key"
                role="gridcell"
                class="flex min-w-0 items-center gap-1.5 border-r border-line-faint px-3.5"
              >
                <RecordCell :field="c.f" :value="items[vr.index]![c.f.key]" />
                <PBadge v-if="ci === 0 && items[vr.index]!._test" tone="ai" size="xs" class="ml-auto">{{
                  t('data.records.test')
                }}</PBadge>
              </div>
              <div class="flex items-center justify-center" @click.stop>
                <PMenu v-if="editable" :items="rowMenu(items[vr.index]!)" :width="180">
                  <PButton
                    square
                    size="xs"
                    variant="ghost"
                    :icon="Ellipsis"
                    :label="t('data.records.edit')"
                    class="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                  />
                </PMenu>
              </div>
            </template>
            <div v-else class="col-span-full flex items-center gap-2 px-3.5 text-sm text-faint">
              <PSpinner :size="12" />{{ t('data.records.loadMore') }}
            </div>
          </div>
        </div>
      </div>
      <div v-if="rows.isLoading.value" class="grid place-items-center py-16 text-faint">
        <PSpinner :size="18" />
      </div>
      <PEmptyState
        v-else-if="!items.length"
        :icon="Rows3"
        :title="q ? t('data.records.noMatch', { q }) : t('data.records.empty')"
        :description="q || !editable ? undefined : t('data.records.emptyHint')"
        class="py-12"
      />
    </div>

    <RowDialog v-model:open="dialogOpen" :table="table" :row="editing" />
    <PDialog
      :open="!!deleting"
      :icon="Trash2"
      :width="420"
      :title="t('data.records.deleteTitle')"
      :description="t('data.records.deleteBody')"
      @update:open="(o) => !o && (deleting = null)"
    >
      <template #footer="{ close }">
        <PButton @click="close">{{ t('data.fields.cancel') }}</PButton>
        <PButton
          variant="danger-solid"
          :loading="del.isPending.value"
          @click="deleting && del.mutate(deleting)"
          >{{ t('data.records.delete') }}</PButton
        >
      </template>
    </PDialog>
  </div>
</template>
