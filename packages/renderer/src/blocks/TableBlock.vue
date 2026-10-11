<script setup lang="ts">
/** Records table built from Platon UI Kit table parts, with kit search and pagination. */
import { computed, ref, watch } from 'vue'
import {
  KitInputSearch,
  KitTable,
  KitTableBody,
  KitTableCell,
  KitTableHead,
  KitTableHeader,
  KitTablePagination,
  KitTableRow,
} from '../kit'
import { type BlockProps, CARD, str, tr, useResolved } from './props'
import { useRows } from './useRows'
import { columnLabel, fieldOf, formatCell, searchRows } from '../format'
import { toneClass } from '../theme'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const { table, columns, rows, loaded } = useRows(props, r)
const q = ref('')
const page = ref(1)
const size = computed(() => Math.max(1, Number(r.value.pageSize) || 25))
const found = computed(() => searchRows(rows.value, q.value))
const shown = computed(() => found.value.slice((page.value - 1) * size.value, page.value * size.value))
watch([q, size], () => (page.value = 1))
const fields = computed(() =>
  columns.value.map((k) => ({ key: k, label: columnLabel(table.value, k), field: fieldOf(table.value, k) })),
)
const cells = computed(() =>
  shown.value.map((row) => ({
    row,
    cells: fields.value.map((c) => formatCell(props.ctx.definition, c.field, row[c.key])),
  })),
)
const summary = computed(() => {
  const from = (page.value - 1) * size.value + 1
  return `${from}–${Math.min(page.value * size.value, found.value.length)} of ${found.value.length}`
})
</script>

<template>
  <div :class="CARD" class="pk overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-3">
      <span class="truncate text-[14px] font-bold">{{
        tr(props, 'title', r.title ?? table?.name ?? 'Table')
      }}</span>
      <span class="shrink-0 text-[12px] text-(--app-faint)">{{
        loaded ? `${rows.length} ${rows.length === 1 ? 'record' : 'records'}` : ''
      }}</span>
      <div v-if="r.search !== false" class="ml-auto w-52 max-w-[45%]">
        <KitInputSearch v-model="q" placeholder="Search" size="compact" clearable />
      </div>
    </div>
    <div class="overflow-x-auto">
      <KitTable class="text-[13px]">
        <KitTableHeader>
          <KitTableRow>
            <KitTableHead v-for="c in fields" :key="c.key" class="whitespace-nowrap">{{
              c.label
            }}</KitTableHead>
          </KitTableRow>
        </KitTableHeader>
        <KitTableBody v-if="loaded">
          <KitTableRow
            v-for="(x, i) in cells"
            :key="str(x.row.id, String(i))"
            class="cursor-pointer"
            @click.stop="emit('event', 'rowClick', x.row)"
          >
            <KitTableCell
              v-for="(c, j) in x.cells"
              :key="j"
              class="whitespace-nowrap"
              :class="c.muted ? 'opacity-60' : ''"
            >
              <span
                v-if="c.tone"
                class="pk-slot inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
                :class="toneClass(c.tone)"
                >{{ c.text }}</span
              >
              <template v-else>{{ c.text }}</template>
            </KitTableCell>
          </KitTableRow>
        </KitTableBody>
        <KitTableBody v-else>
          <KitTableRow v-for="i in 4" :key="i">
            <KitTableCell v-for="c in fields" :key="c.key">
              <div class="pk-slot h-2.5 w-3/4 animate-pulse rounded bg-(--app-subtle)" />
            </KitTableCell>
          </KitTableRow>
        </KitTableBody>
      </KitTable>
      <div v-if="loaded && !cells.length" class="px-4 py-8 text-center text-[12.5px] text-(--app-faint)">
        {{ q ? `Nothing matches “${q}”.` : 'No records to show for this user.' }}
      </div>
      <div v-if="!table" class="px-4 py-6 text-center text-[12.5px] text-(--app-faint)">
        Choose where the data comes from.
      </div>
    </div>
    <div v-if="found.length > size" class="border-t border-(--app-line) px-4 py-2.5 text-[12.5px]">
      <KitTablePagination
        :page="page"
        :page-size="size"
        :total="found.length"
        :summary="summary"
        @page-change="page = $event"
      />
    </div>
  </div>
</template>
