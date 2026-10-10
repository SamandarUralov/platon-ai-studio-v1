<script setup lang="ts">
/** Foreign keys out of and into this table, derived from link fields. Click a table to open it. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRight, KeyRound, Link2 } from 'lucide-vue-next'
import type { Table } from '@platon/definition'
import { columnName, tableName } from '../lib/ddl'
import { relationsIn, relationsOut, type FkRow } from '../lib/model'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ table: Table }>()
const emit = defineEmits<{ open: [tableId: string] }>()
const { t } = useI18n()
const m = useData()
const groups = computed(() => [
  {
    key: 'out',
    icon: Link2,
    iconClass: 'text-primary',
    title: t('data.rels.out'),
    rows: relationsOut(props.table, m.tables.value),
    empty: t('data.rels.outEmpty'),
  },
  {
    key: 'in',
    icon: KeyRound,
    iconClass: 'text-warn-dot',
    title: t('data.rels.in'),
    rows: relationsIn(props.table, m.tables.value),
    empty: t('data.rels.inEmpty'),
  },
])
const GRID = 'grid grid-cols-[minmax(200px,1.5fr)_28px_minmax(170px,1.2fr)_minmax(90px,.6fr)_minmax(0,1fr)]'
/** The side that isn't the current table is the one worth navigating to. */
const target = (r: FkRow, dir: string) => (dir === 'out' ? r.toId : r.fromTable.id)
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <section
      v-for="g in groups"
      :key="g.key"
      class="overflow-hidden rounded-xl border border-line-2 bg-surface"
    >
      <header class="flex items-center gap-2 border-b border-line-faint px-4 py-2.5">
        <component :is="g.icon" :size="14" :class="g.iconClass" />
        <span class="text-md font-bold">{{ g.title }}</span>
        <span class="text-2xs font-bold text-faint-2">{{ g.rows.length }}</span>
      </header>
      <div class="overflow-x-auto">
        <div class="min-w-[640px]">
          <div :class="[GRID, 'border-b border-line-soft bg-subtle-2 text-xs font-semibold text-muted']">
            <div class="px-4 py-2">{{ t('data.rels.column') }}</div>
            <span />
            <div class="px-4 py-2">{{ t('data.rels.references') }}</div>
            <div class="px-4 py-2">{{ t('data.rels.onDelete') }}</div>
            <div class="px-4 py-2">{{ t('data.rels.constraint') }}</div>
          </div>
          <div
            v-for="r in g.rows"
            :key="r.constraint"
            :class="[GRID, 'items-center border-b border-line-faint font-mono text-sm last:border-b-0']"
          >
            <button
              type="button"
              class="flex min-w-0 items-center gap-1.5 px-4 py-2.5 text-left"
              :class="g.key === 'in' ? 'text-primary-strong hover:underline' : ''"
              :disabled="g.key !== 'in'"
              @click="emit('open', r.fromTable.id)"
            >
              <Link2 :size="12" class="shrink-0 text-primary" />
              <span class="truncate"
                >{{ tableName(r.fromTable) }}.<b class="font-semibold">{{ columnName(r.field) }}</b></span
              >
            </button>
            <ArrowRight :size="13" class="text-faint-2" />
            <button
              type="button"
              class="flex min-w-0 items-center gap-1.5 px-4 py-2.5 text-left"
              :class="g.key === 'out' && r.toTable ? 'text-primary-strong hover:underline' : ''"
              :disabled="g.key !== 'out' || !r.toTable"
              @click="emit('open', target(r, g.key))"
            >
              <KeyRound :size="12" class="shrink-0 text-warn-dot" />
              <span v-if="r.toTable" class="truncate">{{ tableName(r.toTable) }}.id</span>
              <span v-else class="truncate text-danger"
                >{{ r.toId || '?' }} · {{ t('data.rels.missing') }}</span
              >
            </button>
            <div class="px-4 py-2.5 text-fg-2">{{ r.onDelete }}</div>
            <div class="truncate px-4 py-2.5 text-faint" :title="r.constraint">{{ r.constraint }}</div>
          </div>
          <div v-if="!g.rows.length" class="p-4 text-sm text-faint">{{ g.empty }}</div>
        </div>
      </div>
    </section>
  </div>
</template>
