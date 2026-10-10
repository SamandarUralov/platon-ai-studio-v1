/**
 * The only place keyboard shortcuts are registered, so they never collide.
 * `mod` = ⌘ on macOS, Ctrl elsewhere. Handlers registered later win (feature beats global).
 */
import { onBeforeUnmount, onMounted } from 'vue'

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD = isMac ? '⌘' : 'Ctrl'

export interface Shortcut {
  /** e.g. "mod+k", "mod+shift+z", "alt+1", "ctrl+`", "mod+enter", "escape" */
  keys: string
  run: (e: KeyboardEvent) => void | boolean
  /** Also fire while typing in inputs/editors (default: only mod-combos fire there). */
  inInputs?: boolean
}

const stack: Shortcut[][] = []

function matches(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.toLowerCase().split('+')
  const key = parts.pop()!
  const want = {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    ctrl: parts.includes('ctrl'),
  }
  const modDown = isMac ? e.metaKey : e.ctrlKey
  if (want.mod !== modDown) return false
  if (want.shift !== e.shiftKey || want.alt !== e.altKey) return false
  if (want.ctrl && !e.ctrlKey) return false
  if (!want.ctrl && !want.mod && e.ctrlKey) return false
  const k = e.key.toLowerCase()
  // Alt changes e.key on macOS (alt+1 → ¡), so fall back to the physical key code.
  const code = e.code.replace(/^Key|^Digit/, '').toLowerCase()
  return (
    k === key || code === key || (key === 'enter' && k === 'enter') || (key === '`' && code === 'backquote')
  )
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return (
    !!t &&
    (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!t.closest('.monaco-editor'))
  )
}

function onKey(e: KeyboardEvent) {
  for (let i = stack.length - 1; i >= 0; i--) {
    for (const s of stack[i]!) {
      if (!matches(e, s.keys)) continue
      const modCombo = /mod|ctrl|alt/.test(s.keys)
      if (isTyping(e) && !s.inInputs && !modCombo) continue
      if (s.run(e) === false) continue
      e.preventDefault()
      e.stopPropagation()
      return
    }
  }
}

let installed = false

export function useShortcuts(list: Shortcut[]) {
  onMounted(() => {
    if (!installed) {
      window.addEventListener('keydown', onKey, true)
      installed = true
    }
    stack.push(list)
  })
  onBeforeUnmount(() => {
    const i = stack.indexOf(list)
    if (i >= 0) stack.splice(i, 1)
  })
}

export function kbd(keys: string): string {
  return keys
    .split('+')
    .map((k) =>
      k === 'mod'
        ? MOD
        : k === 'shift'
          ? '⇧'
          : k === 'alt'
            ? isMac
              ? '⌥'
              : 'Alt'
            : k === 'enter'
              ? '↵'
              : k.toUpperCase(),
    )
    .join(isMac ? '' : '+')
}
