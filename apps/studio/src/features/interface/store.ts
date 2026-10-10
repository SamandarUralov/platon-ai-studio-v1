/** Interface layer UI state: selection, Design/Code mode, viewport and code-editor jumps. */
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { deviceOf, type Device } from './lib/viewport'

export type Mode = 'design' | 'code'
export type RightTab = 'props' | 'ai'

export const useInterfaceStore = defineStore('interface', () => {
  const selected = ref<string | null>(null)
  const mode = ref<Mode>('design')
  const rightTab = ref<RightTab>('props')
  const width = useLocalStorage('platon.canvasWidth', 1440)
  /** 'fit' follows the canvas size; a number is a fixed zoom. */
  const zoom = useLocalStorage<'fit' | number>('platon.canvasZoom', 'fit', {
    serializer: { read: (v) => (v === 'fit' ? 'fit' : Number(v) || 'fit'), write: (v) => String(v) },
  })
  const hand = ref(false)
  /** Zoom actually used (fit resolved by the canvas). */
  const effectiveZoom = ref(1)
  /** One-shot request for the code editor: jump to a line, or insert text at the cursor. */
  const codeRequest = shallowRef<{ line?: number; insert?: string; seq: number } | null>(null)
  let seq = 0

  const device = (): Device => deviceOf(width.value)

  function select(id: string | null) {
    selected.value = id
    if (id) rightTab.value = 'props'
  }
  function jumpTo(line: number) {
    mode.value = 'code'
    codeRequest.value = { line, seq: ++seq }
  }
  function insert(text: string) {
    codeRequest.value = { insert: text, seq: ++seq }
  }

  return {
    selected,
    mode,
    rightTab,
    width,
    zoom,
    hand,
    effectiveZoom,
    codeRequest,
    device,
    select,
    jumpTo,
    insert,
  }
})
