/**
 * Canvas drag & drop on top of Pragmatic DnD: palette tiles create blocks, canvas blocks move.
 * Drop targets report the closest edge, mapped to placeBlock sides (left/right/before/after).
 */
import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types'
import type { BlockType, DropSide } from '@platon/definition'

export type DragData = { kind: 'new'; type: BlockType; component?: string } | { kind: 'move'; id: string }

const KEY = 'platonBlockDrag'

export function isDragData(
  d: Record<string | symbol, unknown>,
): d is Record<string, unknown> & { [KEY]: DragData } {
  return typeof d[KEY] === 'object' && d[KEY] !== null
}
export const dragDataOf = (d: Record<string | symbol, unknown>): DragData | null =>
  isDragData(d) ? d[KEY] : null

const SIDE: Record<Edge, DropSide> = { top: 'before', bottom: 'after', left: 'left', right: 'right' }

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
      onDragStart: opts.onStart,
      onDrop: opts.onEnd,
    })
  })
  onBeforeUnmount(() => off?.())
}

export interface DropHandlers {
  /** Edge the pointer is closest to, or null when it left. */
  over: (side: DropSide | null) => void
  drop: (data: DragData, side: DropSide) => void
  canDrop?: (data: DragData) => boolean
  /** Restrict edges (e.g. the end-of-page zone only accepts "after"). */
  edges?: Edge[]
}

export function useDropTarget(el: Ref<HTMLElement | undefined>, h: DropHandlers) {
  let off: (() => void) | null = null
  const sideOf = (self: { data: Record<string | symbol, unknown> }) => {
    const e = extractClosestEdge(self.data)
    return e ? SIDE[e] : 'after'
  }
  onMounted(() => {
    if (!el.value) return
    off = dropTargetForElements({
      element: el.value,
      canDrop: ({ source }) => {
        const d = dragDataOf(source.data)
        return !!d && (h.canDrop?.(d) ?? true)
      },
      getData: ({ input, element }) =>
        attachClosestEdge(
          {},
          { input, element, allowedEdges: h.edges ?? ['top', 'bottom', 'left', 'right'] },
        ),
      getIsSticky: () => false,
      onDragEnter: ({ self }) => h.over(sideOf(self)),
      onDrag: ({ self }) => h.over(sideOf(self)),
      onDragLeave: () => h.over(null),
      onDrop: ({ self, source }) => {
        h.over(null)
        const d = dragDataOf(source.data)
        if (d) h.drop(d, sideOf(self))
      },
    })
  })
  onBeforeUnmount(() => off?.())
}
