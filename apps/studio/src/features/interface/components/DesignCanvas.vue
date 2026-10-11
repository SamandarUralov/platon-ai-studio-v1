<script setup lang="ts">
/**
 * The design canvas: dotted background and the app at the chosen width and zoom. The app itself is
 * rendered by the Platon Sandbox in an iframe (Interface mode); selecting and dropping happen there
 * and come back as Sandbox events, which we turn into definition edits. The selected block's
 * quick actions are Studio chrome, drawn over the iframe at the rect the Sandbox reports.
 * Zoom: ⌘+wheel (and ⌘+/−/0 via the page). Pan: hold Space (or the hand tool) and drag.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResizeObserver } from '@vueuse/core'
import { canPlaceIn, type BlockType, type CustomComponent, type Page } from '@platon/definition'
import { statsSource } from '@platon/renderer'
import type { Rect, SandboxToStudio } from '@platon/bridge/sandbox'
import SandboxFrame from '@/components/sandbox/SandboxFrame.vue'
import BlockToolbar from './BlockToolbar.vue'
import { ownerBlock, placementOf, toSandboxMeta } from '@/services/sandbox/meta'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'
import { useShortcuts } from '@/composables/useShortcuts'
import { useInterfaceStore } from '../store'
import { useInterfaceEdits } from '../composables/useInterfaceEdits'
import { dragActive, takeLastDrag, type DragData } from '../composables/dnd'
import { createBlock, moveAbility, moveTarget, type MoveDir } from '../lib/blocks'
import { deviceOf, fitZoom } from '../lib/viewport'
import { tablesFor, useTableRecords } from '../api'

const props = defineProps<{ page: Page }>()
const emit = defineEmits<{ go: [pageId: string] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const ui = useInterfaceStore()
const edits = useInterfaceEdits()
const projectId = useProjectId()

const definition = computed(() => def.definition!)
const tableIds = computed(() => tablesFor(props.page, statsSource(definition.value)))
const records = useTableRecords(projectId, tableIds)
const build = computed(() => toSandboxMeta(definition.value, { records: records.value }))
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

// ── sandbox events → edits ─────────────────────────────────────────────────
function onSelect(id: string | null) {
  ui.select(ownerBlock(build.value.nodes, id))
}

function onHover(id: string | null) {
  ui.setHovered(ownerBlock(build.value.nodes, id))
}

// ── block toolbar ──────────────────────────────────────────────────────────
const selRect = ref<{ blockId: string | null; rect: Rect | null }>({ blockId: null, rect: null })
const selBlock = computed(() => props.page.blocks.find((b) => b.id === ui.selected))
/** Only while the reported rect is for the block Studio has selected (not a stale one). */
const toolbarRect = computed(() =>
  selBlock.value && ownerBlock(build.value.nodes, selRect.value.blockId) === selBlock.value.id
    ? selRect.value.rect
    : null,
)
const can = computed(() =>
  selBlock.value
    ? moveAbility(props.page.blocks, selBlock.value.id)
    : { up: false, down: false, left: false, right: false },
)

function moveSelected(dir: MoveDir) {
  const b = selBlock.value
  const to = b && moveTarget(props.page.blocks, b.id, dir)
  if (b && to) edits.moveBlock(props.page, b.id, to.target, to.side)
}
function duplicateSelected() {
  if (selBlock.value) ui.select(edits.duplicateBlock(props.page, selBlock.value).id)
}
function removeSelected() {
  if (!selBlock.value) return
  edits.deleteBlock(props.page, selBlock.value)
  ui.select(null)
}

function onDrop({ parentId, index, source }: SandboxToStudio['drop']) {
  const nodes = build.value.nodes
  const at = placementOf(nodes, props.page.id, parentId, index)
  const moved = source?.blockId ? ownerBlock(nodes, source.blockId) : null
  const d: DragData | null = source?.blockId ? (moved ? { kind: 'move', id: moved } : null) : takeLastDrag()
  if (!at || !d) return
  if (d.kind === 'move') {
    // Dropped on itself, or a container into its own cells: nothing to do.
    if (at.target === d.id || !canPlaceIn(props.page.blocks, d.id, at.cell)) return
    edits.moveBlock(props.page, d.id, at.target, at.side, at.cell)
    ui.select(d.id)
    return
  }
  const comp: CustomComponent | undefined = d.component ? components.value.get(d.component) : undefined
  const b = createBlock(d.type as BlockType, definition.value, props.page, comp)
  if (edits.addBlock(props.page, b, at.target, at.side, at.cell)) ui.select(b.id)
}
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
      <div class="relative">
        <div
          class="overflow-hidden rounded-[14px] border border-line shadow-card"
          :class="space || ui.hand ? 'pointer-events-none' : ''"
        >
          <SandboxFrame
            :meta="build.meta"
            mode="interface"
            :page-id="page.id"
            :selected="ui.selected"
            fit
            return-focus
            :dragging="dragActive"
            @select="onSelect"
            @hover="onHover"
            @rect="selRect = $event"
            @drop="onDrop"
            @page="emit('go', $event)"
          />
        </div>
        <BlockToolbar
          v-if="toolbarRect && !dragActive"
          :rect="toolbarRect"
          :can="can"
          :zoom="zoom"
          @move="moveSelected"
          @duplicate="duplicateSelected"
          @remove="removeSelected"
        />
      </div>
    </div>
  </div>
</template>
