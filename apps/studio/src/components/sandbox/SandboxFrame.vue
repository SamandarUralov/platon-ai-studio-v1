<script lang="ts">
export function sandboxUrl(): URL | null {
  try {
    return new URL(import.meta.env.VITE_SANDBOX_URL || 'http://localhost:5175')
  } catch {
    return null
  }
}
</script>

<script setup lang="ts">
/**
 * The Platon Sandbox (separate repo, separate origin) in an iframe. The app is rendered there, never
 * in the Studio window; we drive it over the typed, origin-checked `@platon/bridge/sandbox` channel:
 *   ready → init(meta) → navigate / set-role / select-block, and re-init whenever the meta changes.
 * The Sandbox reports selection, drops, content size, navigation and console output back.
 */
import { computed, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PButton, PSpinner } from '@platon/ui'
import {
  createSandboxChannel,
  type Rect,
  type SandboxDataMode,
  type SandboxMode,
  type SandboxPatch,
  type SandboxProjectMeta,
  type SandboxToStudio,
} from '@platon/bridge/sandbox'

const props = withDefaults(
  defineProps<{
    meta: SandboxProjectMeta
    mode: SandboxMode
    pageId?: string
    role?: string | null
    /** Sandbox block id to outline. */
    selected?: string | null
    data?: SandboxDataMode
    /** Grow to the content height (canvas) instead of filling the parent and scrolling inside. */
    fit?: boolean
    /** Hand keyboard focus back to the Studio after a canvas click, so its shortcuts keep working. */
    returnFocus?: boolean
    /**
     * A drag started in the Studio is in progress. Native drag events don't reliably reach a
     * cross-origin iframe, so a catcher covers the frame, forwards the pointer as `drag-over` and
     * turns the release into a `drop` at the location the Sandbox last resolved.
     */
    dragging?: boolean
    /**
     * In-place changes to rendered blocks (Preview: what the page script set). Whole values, sent
     * after every init (which resets the tree) and whenever the list changes.
     */
    patches?: SandboxPatch[]
    handshakeMs?: number
  }>(),
  { role: null, selected: null, handshakeMs: 8000 },
)
const emit = defineEmits<{
  select: [id: string | null]
  hover: [id: string | null]
  rect: [m: SandboxToStudio['block-rect']]
  drop: [drop: SandboxToStudio['drop']]
  page: [pageId: string]
  role: [role: string | null]
  log: [entry: { level: 'log' | 'info' | 'warn' | 'error'; text: string; src?: string }]
  'block-event': [e: SandboxToStudio['block-event']]
}>()
const { t } = useI18n()

const url = sandboxUrl()
const origin = url?.origin ?? ''
const src = computed(() => {
  if (!url) return null
  const u = new URL(url)
  u.searchParams.set('studioOrigin', window.location.origin)
  return u.toString()
})

const frame = ref<HTMLIFrameElement>()
/** Bumped to remount the iframe on retry. */
const attempt = ref(0)
const phase = ref<'connecting' | 'ready' | 'unavailable' | 'version'>(url ? 'connecting' : 'unavailable')
const height = ref(0)
/** Where a drag would land: the insertion line and the container receiving it. */
const target = ref<SandboxToStudio['drop-target'] | null>(null)

const channel = createSandboxChannel({ target: () => frame.value?.contentWindow, origin })
let handshake: ReturnType<typeof setTimeout> | null = null
function armHandshake() {
  if (handshake) clearTimeout(handshake)
  handshake = setTimeout(() => phase.value !== 'ready' && (phase.value = 'unavailable'), props.handshakeMs)
}
armHandshake()

// Vue proxies (and query-cache rows) can't be structured-cloned; the meta is plain JSON anyway.
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(toRaw(v))) as T

let queued = false
function sendInit() {
  if (phase.value !== 'ready' || queued) return
  // Several edits in one tick (or a drag that moves many blocks) become one init.
  queued = true
  queueMicrotask(() => {
    queued = false
    channel.send('init', {
      meta: plain(props.meta),
      mode: props.mode,
      pageId: props.pageId,
      role: props.role,
      data: props.data,
      fit: props.fit,
    })
    channel.send('select-block', { blockId: props.selected })
    sendPatches()
  })
}

function sendPatches() {
  for (const patch of props.patches ?? []) channel.send('patch', { patch: plain(patch) })
}

const off = [
  channel.on('ready', () => {
    if (handshake) clearTimeout(handshake)
    phase.value = 'ready'
    sendInit()
  }),
  channel.on('$version-mismatch', () => (phase.value = 'version')),
  channel.on('block-selected', (m) => {
    if (props.returnFocus) frame.value?.blur()
    emit('select', m.blockId)
  }),
  channel.on('block-hover', (m) => emit('hover', m.blockId)),
  channel.on('block-rect', (m) =>
    emit('rect', { blockId: m.blockId, rect: m.rect, ...(m.grid ? { grid: m.grid } : {}) }),
  ),
  channel.on('drop-target', (m) => {
    target.value = m
    awaiting?.(m)
  }),
  channel.on('drop-clear', () => {
    target.value = null
    awaiting?.(null)
  }),
  channel.on('drop', (m) => {
    target.value = null
    emit('drop', m)
  }),
  channel.on('block-event', (m) =>
    emit('block-event', { blockId: m.blockId, event: m.event, payload: m.payload }),
  ),
  channel.on('content-size', (m) => (height.value = m.height)),
  channel.on('page-changed', (m) => m.pageId !== props.pageId && emit('page', m.pageId)),
  channel.on('role-changed', (m) => m.role !== props.role && emit('role', m.role)),
  channel.on('console', (m) =>
    emit('log', { level: m.level === 'debug' ? 'log' : m.level, text: m.args.map(fmt).join(' ') }),
  ),
  channel.on('error', (m) =>
    emit('log', { level: 'error', text: m.message, src: m.source?.blockId ?? m.source?.pageId }),
  ),
]
onBeforeUnmount(() => {
  cancelLeave()
  if (flush) clearTimeout(flush)
  off.forEach((f) => f())
  channel.close()
  if (handshake) clearTimeout(handshake)
})

const box = (r: Rect, min = 0) => ({
  left: `${r.x}px`,
  top: `${r.y}px`,
  width: `${Math.max(r.width, min)}px`,
  height: `${Math.max(r.height, min)}px`,
})

/** The Sandbox sends a 2px seam; widen it around its centre so it reads at any canvas zoom. */
function line(r: Rect) {
  const T = 4
  return r.width >= r.height
    ? box({ x: r.x, y: r.y + r.height / 2 - T / 2, width: r.width, height: T })
    : box({ x: r.x + r.width / 2 - T / 2, y: r.y, width: T, height: r.height })
}

function fmt(v: unknown): string {
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

// Mode is fixed for a frame's lifetime (Interface and Preview mount their own SandboxFrame), so we
// deliver it in `init` and re-init on meta/data/fit changes. The protocol's `set-mode` (SPEC §5,
// switch mode without a full re-init) is intentionally unused here — there is no in-place toggle.
watch(() => [props.meta, props.mode, props.data, props.fit], sendInit)
watch(
  () => props.patches,
  () => phase.value === 'ready' && !queued && sendPatches(),
)
watch(
  () => props.pageId,
  (pageId) => pageId && phase.value === 'ready' && channel.send('navigate', { pageId }),
)
watch(
  () => props.role,
  (role) => phase.value === 'ready' && channel.send('set-role', { role }),
)
watch(
  () => props.selected,
  (blockId) => phase.value === 'ready' && channel.send('select-block', { blockId }),
)

// ── drags started in the Studio ────────────────────────────────────────────
/**
 * Pointer in the iframe's own CSS pixels; the canvas may be zoomed around it. Measured on the
 * iframe, not the catcher: the palette ends the drag before the catcher hears the drop, and Vue has
 * removed the catcher by then (microtasks run between listeners), so it would measure as empty.
 */
function framePoint(e: DragEvent) {
  const el = frame.value
  if (!el) return { x: e.clientX, y: e.clientY }
  const r = el.getBoundingClientRect()
  const scale = r.width ? el.offsetWidth / r.width : 1
  return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale }
}

// dragover fires every few ms; forward at most one point per FORWARD_MS.
const FORWARD_MS = 30
let lastSent = 0
let pending: { x: number; y: number } | null = null
let flush: ReturnType<typeof setTimeout> | null = null
function forward(point: { x: number; y: number }) {
  pending = point
  if (flush) return
  const wait = Math.max(0, lastSent + FORWARD_MS - Date.now())
  flush = setTimeout(() => {
    flush = null
    if (!pending) return
    channel.send('drag-over', { point: pending })
    pending = null
    lastSent = Date.now()
  }, wait)
}

/** The next drop location the Sandbox reports (null = nothing there), or null on timeout. */
let awaiting: ((t: SandboxToStudio['drop-target'] | null) => void) | null = null
function nextTarget(ms = 300) {
  return new Promise<SandboxToStudio['drop-target'] | null>((resolve) => {
    const timer = setTimeout(() => settle(null), ms)
    function settle(t: SandboxToStudio['drop-target'] | null) {
      clearTimeout(timer)
      awaiting = null
      resolve(t)
    }
    awaiting = settle
  })
}

// A dragleave also fires right before the drop; clearing then would flash the indicator off.
let leaving: ReturnType<typeof setTimeout> | null = null
function cancelLeave() {
  if (leaving) clearTimeout(leaving)
  leaving = null
}
function onDragLeave() {
  cancelLeave()
  leaving = setTimeout(endDrag, 80)
}
function onDragOver(e: DragEvent) {
  e.preventDefault()
  cancelLeave()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  forward(framePoint(e))
}
function endDrag() {
  cancelLeave()
  if (flush) clearTimeout(flush)
  flush = null
  pending = null
  target.value = null
  if (phase.value === 'ready') channel.send('drag-end', {})
}
/**
 * Resolve the release point itself rather than trusting the last indicator: a quick drag may end
 * before any forwarded point was answered.
 */
async function onDrop(e: DragEvent) {
  e.preventDefault()
  cancelLeave()
  if (flush) clearTimeout(flush)
  flush = null
  pending = null
  const answer = nextTarget()
  channel.send('drag-over', { point: framePoint(e) })
  const t = await answer
  endDrag()
  if (t) emit('drop', { parentId: t.parentId, index: t.index })
}
// The drag source reports the end (window-level, before our drop handler runs and with microtasks
// in between), so clean up on the next task, after the drop has started resolving.
watch(
  () => props.dragging,
  (on) => !on && !awaiting && setTimeout(() => !awaiting && endDrag()),
)

function retry() {
  if (!src.value) return
  phase.value = 'connecting'
  height.value = 0
  attempt.value++
  armHandshake()
}
</script>

<template>
  <div class="relative h-full w-full">
    <iframe
      v-if="src"
      :key="attempt"
      ref="frame"
      :src="src"
      :title="t('sandbox.title')"
      class="block w-full border-0 bg-surface"
      :class="fit ? '' : 'h-full'"
      :style="fit ? { height: `${Math.max(height, 480)}px` } : undefined"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      referrerpolicy="no-referrer"
    />
    <div
      v-if="dragging && phase === 'ready'"
      class="absolute inset-0 z-10"
      @dragover="onDragOver"
      @dragleave.self="onDragLeave"
      @drop="onDrop"
    />
    <template v-if="target">
      <div
        v-if="target.parentRect && target.parentId"
        class="pointer-events-none absolute z-20 rounded-lg border-2 border-dashed border-primary bg-primary-tint/40"
        :style="box(target.parentRect)"
      />
      <div
        v-if="target.rect"
        class="pointer-events-none absolute z-20 rounded-full bg-primary"
        :style="line(target.rect)"
      />
    </template>
    <div
      v-if="phase !== 'ready'"
      class="absolute inset-0 grid min-h-80 place-items-center bg-surface text-center"
      role="status"
    >
      <div v-if="phase === 'connecting'" class="flex items-center gap-2 text-sm text-muted">
        <PSpinner :size="16" />{{ t('sandbox.connecting') }}
      </div>
      <div v-else class="max-w-sm px-6">
        <p class="text-[15px] font-bold text-fg">
          {{ phase === 'version' ? t('sandbox.version') : t('sandbox.unavailable') }}
        </p>
        <p class="mt-1 text-sm text-muted">{{ t('sandbox.hint', { url: url?.origin ?? '—' }) }}</p>
        <PButton v-if="src" class="mt-4" @click="retry">{{ t('sandbox.retry') }}</PButton>
      </div>
    </div>
  </div>
</template>
