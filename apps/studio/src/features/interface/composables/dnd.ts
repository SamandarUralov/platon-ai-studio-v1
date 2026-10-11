/**
 * Palette drag sources on top of Pragmatic DnD. The canvas is the Sandbox iframe (another origin)
 * and native drag events don't reliably reach a cross-origin frame, so while a tile is dragged the
 * canvas lays a catcher over the iframe, forwards the pointer (`drag-over`) and the Sandbox answers
 * with the drop location; on drop it is paired with what was dragged here (`takeLastDrag`).
 * Blocks already on the canvas are dragged inside the Sandbox and arrive with their id instead.
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { BlockType } from '@platon/definition'

export type DragData = { kind: 'new'; type: BlockType; component?: string } | { kind: 'move'; id: string }

const KEY = 'platonBlockDrag'

/** True while a palette tile is being dragged: the canvas then catches the drag above the iframe. */
export const dragActive = ref(false)

/** The Sandbox's drop report can arrive just after dragend here, so the payload outlives the drag. */
const DROP_GRACE_MS = 1500
let last: { data: DragData; endedAt: number | null } | null = null

/** What the last drag carried, if it is still running or just ended. Consumed once. */
export function takeLastDrag(now = Date.now()): DragData | null {
  const l = last
  last = null
  if (!l || (l.endedAt !== null && now - l.endedAt > DROP_GRACE_MS)) return null
  return l.data
}

export function useDraggable(
  el: Ref<HTMLElement | undefined>,
  data: () => DragData,
  opts: { handle?: Ref<HTMLElement | undefined>; onStart?: () => void; onEnd?: () => void } = {},
) {
  let off: (() => void) | null = null
  onMounted(() => {
    if (!el.value) return
    off = draggable({
      element: el.value,
      dragHandle: opts.handle?.value,
      getInitialData: () => ({ [KEY]: data() }),
      onDragStart: () => {
        last = { data: data(), endedAt: null }
        dragActive.value = true
        opts.onStart?.()
      },
      onDrop: () => {
        if (last) last.endedAt = Date.now()
        dragActive.value = false
        opts.onEnd?.()
      },
    })
  })
  onBeforeUnmount(() => off?.())
}
