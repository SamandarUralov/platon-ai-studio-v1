<script setup lang="ts">
/**
 * The design canvas: dotted background, the app frame at the chosen width and zoom, blocks in rows.
 * Zoom: ⌘+wheel (and ⌘+/−/0 via the page). Pan: hold Space (or the hand tool) and drag.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResizeObserver } from '@vueuse/core'
import { Download } from 'lucide-vue-next'
import {
  toRows,
  type Block,
  type BlockType,
  type CustomComponent,
  type DropSide,
  type Page,
} from '@platon/definition'
import { AppFrame, statsSource, type RenderContext } from '@platon/renderer'
import { useDefinitionStore } from '@/stores/definition'
import { useSessionStore } from '@/stores/session'
import { useProjectId } from '@/composables/useProject'
import { useShortcuts } from '@/composables/useShortcuts'
import { useInterfaceStore } from '../store'
import { useInterfaceEdits } from '../composables/useInterfaceEdits'
import { useDropTarget, type DragData } from '../composables/dnd'
import { createBlock } from '../lib/blocks'
import { deviceOf, fitZoom } from '../lib/viewport'
import { tablesFor, useTableRecords } from '../api'
import CanvasBlock, { type MoveAbility } from './CanvasBlock.vue'

const props = defineProps<{ page: Page }>()
const emit = defineEmits<{ go: [pageId: string] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const session = useSessionStore()
const ui = useInterfaceStore()
const edits = useInterfaceEdits()
const projectId = useProjectId()

const definition = computed(() => def.definition!)
const rows = computed(() => toRows(props.page.blocks))
const tableIds = computed(() => tablesFor(props.page, statsSource(definition.value)))
const records = useTableRecords(projectId, tableIds)
const ctx = computed<RenderContext>(() => ({
  definition: definition.value,
  records: records.value,
  design: true,
}))
const components = computed(() => new Map((definition.value.components ?? []).map((c) => [c.id, c])))

// ── zoom & pan ─────────────────────────────────────────────────────────────
const scroller = ref<HTMLElement>()
const available = ref(1200)
useResizeObserver(scroller, (e) => (available.value = e[0]!.contentRect.width))
const zoom = computed(() => (ui.zoom === 'fit' ? fitZoom(ui.width, available.value) : ui.zoom))
watch(zoom, (z) => (ui.effectiveZoom = z), { immediate: true })
const frameInfo = computed(() => {
  const d = t(`interface.vp.${deviceOf(ui.width)}`)
  return `${ui.width}px · ${d} · ${Math.round(zoom.value * 100)}%${ui.zoom === 'fit' ? ` (${t('interface.vp.fit').toLowerCase()})` : ''}`
})

function onWheel(e: WheelEvent) {
  if (!e.metaKey && !e.ctrlKey) return
  e.preventDefault()
  ui.zoom = Math.min(2, Math.max(0.2, Math.round(zoom.value * (1 - e.deltaY * 0.0025) * 100) / 100))
}
onMounted(() => scroller.value?.addEventListener('wheel', onWheel, { passive: false }))
onBeforeUnmount(() => scroller.value?.removeEventListener('wheel', onWheel))

const space = ref(false)
const panning = ref(false)
const onKeyUp = (e: KeyboardEvent) => e.code === 'Space' && (space.value = false)
onMounted(() => window.addEventListener('keyup', onKeyUp))
onBeforeUnmount(() => window.removeEventListener('keyup', onKeyUp))
useShortcuts([{ keys: 'space', run: () => void (space.value = true) }])

function onPointerDown(e: PointerEvent) {
  if (!(space.value || ui.hand) || !scroller.value) return
  e.preventDefault()
  const el = scroller.value
  const start = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop }
  panning.value = true
  el.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => {
    el.scrollLeft = start.l - (ev.clientX - start.x)
    el.scrollTop = start.t - (ev.clientY - start.y)
  }
  const up = () => {
    panning.value = false
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
}
const cursor = computed(() =>
  panning.value ? 'cursor-grabbing' : space.value || ui.hand ? 'cursor-grab' : '',
)

// ── edits ──────────────────────────────────────────────────────────────────
function onDrop(d: DragData, target: string | null, side: DropSide) {
  if (d.kind === 'move') {
    edits.moveBlock(props.page, d.id, target, side)
    ui.select(d.id)
    return
  }
  const comp: CustomComponent | undefined = d.component ? components.value.get(d.component) : undefined
  const b = createBlock(d.type as BlockType, definition.value, props.page, comp)
  if (edits.addBlock(props.page, b, target, side)) ui.select(b.id)
}

function ability(b: Block): MoveAbility {
  const r = rows.value.findIndex((row) => row.some((x) => x.id === b.id))
  const row = rows.value[r]!
  const c = row.findIndex((x) => x.id === b.id)
  return {
    up: r > 0 || row.length > 1,
    down: r < rows.value.length - 1 || row.length > 1,
    left: c > 0,
    right: c < row.length - 1,
  }
}

function move(b: Block, dir: keyof MoveAbility) {
  const r = rows.value.findIndex((row) => row.some((x) => x.id === b.id))
  const row = rows.value[r]!
  const c = row.findIndex((x) => x.id === b.id)
  if (dir === 'left') edits.moveBlock(props.page, b.id, row[c - 1]!.id, 'left')
  else if (dir === 'right') edits.moveBlock(props.page, b.id, row[c + 1]!.id, 'right')
  else if (dir === 'up') {
    const prev = row.length > 1 ? row[0]! : rows.value[r - 1]?.[0]
    if (prev) edits.moveBlock(props.page, b.id, prev.id, 'before')
  } else {
    const next = row.length > 1 ? row.at(-1)! : rows.value[r + 1]?.at(-1)
    if (next) edits.moveBlock(props.page, b.id, next.id, 'after')
  }
}

function restricted(b: Block): string | null {
  const v = b.visibility
  if (!v?.roles && !v?.condition) return null
  if (v.roles && !v.roles.length) return t('interface.vis.nobodyShort')
  if (v.roles) return v.roles.map((r) => definition.value.roles.find((x) => x.id === r)?.name ?? r).join(', ')
  return t('interface.vis.conditional')
}

const endZone = ref<HTMLElement>()
const endOver = ref(false)
useDropTarget(endZone, {
  over: (s) => (endOver.value = !!s),
  drop: (d) => onDrop(d, null, 'after'),
  edges: ['top'],
})

const user = computed(() => ({
  name: session.user?.name ?? 'Maya Chen',
  role: definition.value.roles[0]?.name ?? '',
}))
</script>

<template>
  <div
    ref="scroller"
    class="relative min-h-0 flex-1 overflow-auto bg-canvas bg-dots px-6 pt-7 pb-16 scroll-thin"
    :class="cursor"
    @pointerdown="onPointerDown"
    @click="ui.select(null)"
  >
    <div class="mx-auto" :style="{ width: `${ui.width}px`, zoom }">
      <div class="px-0.5 pb-2 font-mono text-xs font-semibold whitespace-nowrap text-faint">
        {{ frameInfo }}
      </div>
      <div
        class="overflow-hidden rounded-[14px] border border-line shadow-card"
        :class="space || ui.hand ? 'pointer-events-none' : ''"
      >
        <AppFrame
          :definition="definition"
          :page-id="page.id"
          :width="ui.width"
          :user="user"
          @navigate="emit('go', $event)"
        >
          <div class="flex flex-col gap-5 pt-1">
            <div v-for="(row, i) in rows" :key="i" class="flex flex-wrap gap-4">
              <CanvasBlock
                v-for="b in row"
                :key="b.id"
                :block="b"
                :ctx="ctx"
                :selected="ui.selected === b.id"
                :can="ability(b)"
                :restricted="restricted(b)"
                :component="b.type === 'custom' ? components.get(b.component ?? '') : null"
                :zoom="zoom"
                :first="i === 0"
                @select="ui.select(b.id)"
                @move="move(b, $event)"
                @duplicate="ui.select(edits.duplicateBlock(page, b).id)"
                @remove="(edits.deleteBlock(page, b), ui.select(null))"
                @drop="(d, s) => onDrop(d, b.id, s)"
              />
            </div>
            <div
              ref="endZone"
              class="flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm transition-colors"
              :class="
                endOver ? 'border-primary bg-primary-tint text-primary-strong' : 'border-line text-faint'
              "
            >
              <Download :size="14" />{{
                page.blocks.length ? t('interface.canvas.dropHere') : t('interface.canvas.emptyPage')
              }}
            </div>
          </div>
        </AppFrame>
      </div>
    </div>
  </div>
</template>
