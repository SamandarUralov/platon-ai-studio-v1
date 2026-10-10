<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import { type BlockProps, CARD, str, tr, useResolved } from './props'
import { useRows } from './useRows'
import { columnLabel, fieldOf, formatCell, searchRows } from '../format'
import { toneClass } from '../theme'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const { table, columns, rows, loaded } = useRows(props, r)
const q = ref('')
const limit = computed(() => Number(r.value.pageSize) || 25)
const shown = computed(() => searchRows(rows.value, q.value).slice(0, limit.value))
const fields = computed(() =>
  columns.value.map((k) => ({ key: k, label: columnLabel(table.value, k), field: fieldOf(table.value, k) })),
)
const cells = computed(() =>
  shown.value.map((row) => ({
    row,
    cells: fields.value.map((c) => formatCell(props.ctx.definition, c.field, row[c.key])),
  })),
)
</script>

<template>
  <div :class="CARD" class="overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-3">
      <span class="truncate text-[14px] font-bold">{{
        tr(props, 'title', r.title ?? table?.name ?? 'Table')
      }}</span>
      <span class="shrink-0 text-[12px] text-(--app-faint)">{{
        loaded ? `${rows.length} ${rows.length === 1 ? 'record' : 'records'}` : ''
      }}</span>
      <label class="relative ml-auto w-44 max-w-[40%]">
        <Search
          :size="13"
          class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-(--app-faint)"
        />
        <input
          v-model="q"
          :disabled="ctx.design"
          placeholder="Search"
          class="h-8 w-full rounded-(--app-radius) border border-(--app-line) bg-(--app-surface) pr-2 pl-7 text-[12.5px] text-(--app-fg) outline-none placeholder:text-(--app-faint) focus:border-(--app-accent)"
        />
      </label>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr class="bg-(--app-subtle) text-left text-[12px] text-(--app-muted)">
            <th
              v-for="c in fields"
              :key="c.key"
              class="border-y border-(--app-line) px-4 py-2 font-semibold whitespace-nowrap"
            >
              {{ c.label }}
            </th>
          </tr>
        </thead>
        <tbody v-if="loaded">
          <tr
            v-for="(x, i) in cells"
            :key="str(x.row.id, String(i))"
            class="cursor-pointer border-b border-(--app-line-soft) last:border-b-0 hover:bg-(--app-hover)"
            @click.stop="emit('event', 'rowClick', x.row)"
          >
            <td
              v-for="(c, j) in x.cells"
              :key="j"
              class="px-4 py-2.5 whitespace-nowrap"
              :class="c.muted ? 'text-(--app-faint)' : ''"
            >
              <span
                v-if="c.tone"
                class="inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
                :class="toneClass(c.tone)"
                >{{ c.text }}</span
              >
              <template v-else>{{ c.text }}</template>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-for="i in 4" :key="i" class="border-b border-(--app-line-soft)">
            <td v-for="c in fields" :key="c.key" class="px-4 py-3">
              <div class="h-2.5 w-3/4 animate-pulse rounded bg-(--app-subtle)" />
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="loaded && !cells.length" class="px-4 py-8 text-center text-[12.5px] text-(--app-faint)">
        {{ q ? `Nothing matches “${q}”.` : 'No records to show for this user.' }}
      </div>
      <div v-if="!table" class="px-4 py-6 text-center text-[12.5px] text-(--app-faint)">
        Choose where the data comes from.
      </div>
    </div>
  </div>
</template>
