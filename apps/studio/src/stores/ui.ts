/** Studio chrome state: panels, console, pins/recent locations. Persisted per browser. */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export interface Pin {
  path: string
  label: string
  icon: string
  layer: string
}

export const useUiStore = defineStore('ui', () => {
  const leftOpen = useLocalStorage('platon.leftOpen', true)
  const rightOpen = useLocalStorage('platon.rightOpen', true)
  const leftWidth = useLocalStorage('platon.leftWidth', 268)
  const rightWidth = useLocalStorage('platon.rightWidth', 340)
  const consoleOpen = ref(false)
  const consoleHeight = useLocalStorage('platon.consoleHeight', 260)
  const paletteOpen = ref(false)
  const shortcutsOpen = ref(false)
  const pins = useLocalStorage<Pin[]>('platon.pins', [])
  const recent = useLocalStorage<Pin[]>('platon.recent', [])
  /** Panels hidden by ⌘\ remember what was open before. */
  const focusMemo = ref<{ left: boolean; right: boolean } | null>(null)

  const focusMode = computed(() => !!focusMemo.value)

  function toggleFocus() {
    if (focusMemo.value) {
      leftOpen.value = focusMemo.value.left
      rightOpen.value = focusMemo.value.right
      focusMemo.value = null
    } else {
      focusMemo.value = { left: leftOpen.value, right: rightOpen.value }
      leftOpen.value = false
      rightOpen.value = false
    }
  }

  function visit(p: Pin) {
    recent.value = [p, ...recent.value.filter((x) => x.path !== p.path)].slice(0, 12)
  }
  function isPinned(path: string) {
    return pins.value.some((p) => p.path === path)
  }
  function togglePin(p: Pin) {
    pins.value = isPinned(p.path)
      ? pins.value.filter((x) => x.path !== p.path)
      : [...pins.value, p].slice(0, 9)
  }

  return {
    leftOpen,
    rightOpen,
    leftWidth,
    rightWidth,
    consoleOpen,
    consoleHeight,
    paletteOpen,
    shortcutsOpen,
    pins,
    recent,
    focusMode,
    toggleFocus,
    visit,
    isPinned,
    togglePin,
  }
})
