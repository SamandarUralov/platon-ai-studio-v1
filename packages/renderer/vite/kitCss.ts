/**
 * Makes the Platon UI Kit stylesheet safe to load inside Studio.
 *
 * The kit ships a compiled Tailwind 3 sheet: a global preflight, `:root` variables and utilities
 * whose names clash with Studio's Tailwind 4 ones (`bg-primary` means a different colour in each).
 * Loaded as-is it would restyle Studio. Instead the sheet is emitted twice:
 *
 * - `@layer platon-kit { … }` without element/universal rules: the lowest layer (Studio declares it
 *   before Tailwind's), so it only styles things Studio has no class for — e.g. kit popovers that
 *   teleport to <body>.
 * - `@scope (.pk) to (.pk-slot) { … }` complete and unlayered: inside a kit block's `.pk` wrapper the
 *   kit wins, as it expects; `.pk-slot` stops it at blocks nested in kit containers.
 *
 * The kit's primary colour becomes `--pk-primary` so components follow the app accent, and the
 * remote Google Fonts import is dropped (fonts are self-hosted; the app font is inherited).
 */
import type { Plugin } from 'vite'

interface Rule {
  prelude: string
  body: string | null
}

/** Top-level rules of a CSS string (statements like `@import …;` have a null body). */
export function splitRules(css: string): Rule[] {
  const out: Rule[] = []
  let i = 0
  let start = 0
  const n = css.length
  const skipString = (j: number) => {
    const q = css[j]
    for (j++; j < n && css[j] !== q; j++) if (css[j] === '\\') j++
    return j
  }
  while (i < n) {
    const ch = css[i]
    if (ch === '"' || ch === "'") i = skipString(i)
    else if (ch === '/' && css[i + 1] === '*')
      i = css.indexOf('*/', i + 2) < 0 ? n : css.indexOf('*/', i + 2) + 1
    else if (ch === ';') {
      const prelude = css.slice(start, i).trim()
      if (prelude) out.push({ prelude, body: null })
      start = i + 1
    } else if (ch === '{') {
      let depth = 1
      let j = i + 1
      for (; j < n && depth; j++) {
        const c = css[j]
        if (c === '"' || c === "'") j = skipString(j)
        else if (c === '{') depth++
        else if (c === '}') depth--
      }
      out.push({ prelude: css.slice(start, i).trim(), body: css.slice(i + 1, j - 1) })
      i = j - 1
      start = j
    }
    i++
  }
  return out
}

const NESTED = /^@(media|supports|layer|container)\b/i
const GLOBAL_ONLY = /^@(keyframes|-webkit-keyframes|font-face|property|counter-style)\b/i
/** Rules that only use element / universal / pseudo selectors, i.e. preflight. */
const isBare = (sel: string) => !/[.[]/.test(sel) && sel.trim() !== ':root'

function rewrite(rules: Rule[], mode: 'layer' | 'scope'): string {
  let out = ''
  for (const r of rules) {
    if (r.body === null) continue // @import (remote fonts), @charset
    if (r.prelude.startsWith('@')) {
      if (NESTED.test(r.prelude)) {
        const inner = rewrite(splitRules(r.body), mode)
        if (inner) out += `${r.prelude}{${inner}}`
      } else if (GLOBAL_ONLY.test(r.prelude)) {
        if (mode === 'layer') out += `${r.prelude}{${r.body}}`
      } else out += `${r.prelude}{${r.body}}`
      continue
    }
    if (mode === 'layer' && isBare(r.prelude)) continue
    const sel = mode === 'scope' ? r.prelude.replace(/(^|,)\s*:root\b/g, '$1:scope') : r.prelude
    out += `${sel}{${r.body}}`
  }
  return out
}

const PRIMARY = 'var(--pk-primary,30 107 216)'

export function scopeKitCss(css: string): string {
  const rules = splitRules(css)
  const recolor = (s: string) =>
    s.replace(/\b30 107 216\b/g, PRIMARY).replace(/#1e6bd8\b/gi, `rgb(${PRIMARY})`)
  return recolor(
    `@layer platon-kit{${rewrite(rules, 'layer')}}\n@scope (.pk) to (.pk-slot){${rewrite(rules, 'scope')}}\n`,
  )
}

const KIT_CSS = /@platon-rs[\\/]platon-ui-kit[\\/]dist[\\/]platon-ui-kit\.css$/

export function platonKitCss(): Plugin {
  return {
    name: 'platon-kit-css',
    enforce: 'pre',
    transform(code, id) {
      if (!KIT_CSS.test(id.split('?')[0]!)) return null
      return { code: scopeKitCss(code), map: null }
    },
  }
}
