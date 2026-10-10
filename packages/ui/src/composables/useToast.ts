import { reactive } from 'vue'
import type { Tone } from '../utils/tone'

export interface ToastItem {
  id: number
  text: string
  tone: Tone
  action?: { label: string; run: () => void }
}

const state = reactive<{ items: ToastItem[] }>({ items: [] })
let seq = 0

export function toast(
  text: string,
  opts: { tone?: Tone; action?: ToastItem['action']; duration?: number } = {},
): void {
  const id = ++seq
  state.items.push({ id, text, tone: opts.tone ?? 'neutral', action: opts.action })
  // Keep at most three on screen; older ones drop off first.
  if (state.items.length > 3) state.items.shift()
  setTimeout(() => dismissToast(id), opts.duration ?? 3200)
}

export function dismissToast(id: number): void {
  const i = state.items.findIndex((t) => t.id === id)
  if (i >= 0) state.items.splice(i, 1)
}

export function useToasts() {
  return state
}
