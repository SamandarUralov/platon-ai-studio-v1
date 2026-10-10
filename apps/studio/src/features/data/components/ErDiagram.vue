<script setup lang="ts">
/**
 * ER diagram of every table in one connection. Cards drag by their header; positions are kept per
 * project + connection in localStorage. Auto-arrange runs ELK (layered, left → right).
 */
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, KeyRound, LayoutGrid, Link2, Minus, Table2 } from 'lucide-vue-next'
import { PButton, PEmptyState, PTooltip, toast } from '@platon/ui'
import { ENGINES, FIELD_TYPES, type DbConnection, type TableField } from '@platon/definition'
import EngineLogo from './EngineLogo.vue'
import {
  canvasSize,
  edgePath,
  elkLayout,
  ER,
  erEdges,
  gridLayout,
  mergePositions,
  type Positions,
} from '../lib/er'
import { columnName, isSqlEngine, sqlType, tableName } from '../lib/ddl'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ conn: DbConnection; activeId?: string | null }>()
const emit = defineEmits<{ open: [tableId: string] }>()
const { t } = useI18n()
const m = useData()

const tables = computed(() => m.tablesOf(props.conn.id))
const storageKey = computed(() => `platon.data.er.${m.pid.value}.${props.conn.id}`)

function readSaved(): Positions {
  try {
    const raw = localStorage.getItem(storageKey.value)
    return raw ? (JSON.parse(raw) as Positions) : {}
  } catch {
    return {}
  }
}
function writeSaved(p: Positions) {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(p))
  } catch {
    // Storage full or blocked — positions just won't survive a reload.
  }
}

const saved = shallowRef<Positions>(readSaved())
const pos = computed(() => mergePositions(tables.value, saved.value, gridLayout(tables.value)))
const edges = computed(() => erEdges(tables.value))
const paths = computed(() =>
  edges.value.map((e) => edgePath(e, pos.value, props.activeId)).filter((p) => !!p),
)
const size = computed(() => canvasSize(tables.value, pos.value))

const arranging = ref(false)
async function arrange() {
  arranging.value = true
  try {
    saved.value = await elkLayout(tables.value)
    writeSaved(saved.value)
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), { tone: 'danger' })
  } finally {
    arranging.value = false
  }
}

watch(storageKey, () => {
  saved.value = readSaved()
  if (!Object.keys(saved.value).length && tables.value.length) void arrange()
})
onMounted(() => {
  if (!Object.keys(saved.value).length && tables.value.length) void arrange()
})

// ── drag by header
function startDrag(id: string, e: PointerEvent) {
  if (e.button !== 0) return
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const start = pos.value[id]!
  const sx = e.clientX
  const sy = e.clientY
  const move = (ev: PointerEvent) => {
    saved.value = {
      ...pos.value,
      [id]: {
        x: Math.max(0, Math.round(start.x + ev.clientX - sx)),
        y: Math.max(0, Math.round(start.y + ev.clientY - sy)),
      },
    }
  }
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    writeSaved(saved.value)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
}

const typeOf = (f: TableField) =>
  isSqlEngine(props.conn.engine)
    ? sqlType(f.type, props.conn.engine)
        .replace(/\(.*\)/, '')
        .toLowerCase()
    : FIELD_TYPES[f.type].label.toLowerCase()
const idType = computed(() =>
  isSqlEngine(props.conn.engine) ? 'bigint' : props.conn.engine === 'mongo' ? 'objectId' : 'key',
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-2.5">
    <div class="flex flex-wrap items-center gap-2.5">
      <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-2">
        <EngineLogo :engine="conn.engine" size="sm" />{{ conn.name }} · {{ ENGINES[conn.engine].label }} ·
        {{ tables.length }} {{ ENGINES[conn.engine].kind.toLowerCase() }}
      </span>
      <span class="text-xs text-faint">{{ t('data.diagram.hint') }}</span>
      <div class="ml-auto flex items-center gap-3 text-xs text-muted">
        <span class="flex items-center gap-1"
          ><KeyRound :size="12" class="text-warn-dot" />{{ t('data.diagram.pk') }}</span
        >
        <span class="flex items-center gap-1"
          ><Link2 :size="12" class="text-primary" />{{ t('data.diagram.fk') }}</span
        >
        <PButton size="xs" :icon="LayoutGrid" :loading="arranging" @click="arrange">{{
          t('data.diagram.arrange')
        }}</PButton>
      </div>
    </div>
    <div
      class="bg-dots scroll-thin relative min-h-[420px] flex-1 overflow-auto rounded-xl border border-line-2"
    >
      <PEmptyState v-if="!tables.length" :icon="Table2" :title="t('data.diagram.empty')" class="py-16" />
      <div v-else class="relative" :style="{ width: `${size.w}px`, height: `${size.h}px` }">
        <svg
          :width="size.w"
          :height="size.h"
          class="pointer-events-none absolute left-0 top-0 overflow-visible"
          aria-hidden="true"
        >
          <path
            v-for="p in paths"
            :key="p.id"
            :d="p.d"
            fill="none"
            :class="p.hot ? 'stroke-primary' : 'stroke-primary-ring'"
            :stroke-width="p.hot ? 2 : 1.5"
          />
        </svg>
        <div
          v-for="tb in tables"
          :key="tb.id"
          class="absolute overflow-hidden rounded-[10px] border-[1.5px] bg-surface"
          :class="tb.id === activeId ? 'border-primary shadow-pop' : 'border-line shadow-card'"
          :style="{ left: `${pos[tb.id]!.x}px`, top: `${pos[tb.id]!.y}px`, width: `${ER.width}px` }"
        >
          <div
            class="flex cursor-move touch-none select-none items-center gap-2 px-2.5"
            :class="tb.id === activeId ? 'bg-primary text-on-accent' : 'bg-subtle text-fg'"
            :style="{ height: `${ER.head}px` }"
            @pointerdown="startDrag(tb.id, $event)"
            @dblclick="emit('open', tb.id)"
          >
            <Table2 :size="14" class="shrink-0" />
            <span class="min-w-0 flex-1 truncate font-mono text-base font-bold">{{ tableName(tb) }}</span>
            <PTooltip :text="t('data.diagram.open', { name: tb.name })">
              <button
                type="button"
                class="grid size-6 place-items-center rounded-md opacity-70 hover:opacity-100"
                :aria-label="t('data.diagram.open', { name: tb.name })"
                @pointerdown.stop
                @click="emit('open', tb.id)"
              >
                <ExternalLink :size="12" />
              </button>
            </PTooltip>
          </div>
          <div
            class="flex items-center gap-1.5 border-t border-line-faint px-2.5 font-mono text-xs"
            :style="{ height: `${ER.row}px` }"
          >
            <KeyRound :size="11" class="w-3 shrink-0 text-warn-dot" /><span class="flex-1 truncate">id</span
            ><span class="text-faint">{{ idType }}</span>
          </div>
          <div
            v-for="f in tb.fields"
            :key="f.key"
            class="flex items-center gap-1.5 border-t border-line-faint px-2.5 font-mono text-xs"
            :style="{ height: `${ER.row}px` }"
          >
            <Link2 v-if="f.type === 'link'" :size="11" class="w-3 shrink-0 text-primary" />
            <Minus v-else :size="11" class="w-3 shrink-0 text-faint-2" />
            <span class="min-w-0 flex-1 truncate">{{ columnName(f) }}</span>
            <span class="text-faint">{{ typeOf(f) }}</span>
          </div>
        </div>
        <template v-for="p in paths" :key="`${p.id}-ends`">
          <span
            class="absolute grid h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[1.5px] bg-surface px-1 font-mono text-[9.5px] font-extrabold"
            :class="p.hot ? 'border-primary text-primary' : 'border-primary-ring text-primary-strong'"
            :style="{ left: `${p.from.x}px`, top: `${p.from.y}px` }"
            >N</span
          >
          <span
            class="absolute grid h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[1.5px] bg-surface px-1 font-mono text-[9.5px] font-extrabold"
            :class="p.hot ? 'border-primary text-primary' : 'border-primary-ring text-primary-strong'"
            :style="{ left: `${p.to.x}px`, top: `${p.to.y}px` }"
            >1</span
          >
        </template>
      </div>
    </div>
  </div>
</template>
