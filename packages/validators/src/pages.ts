/** Checks for pages, page scripts and lifecycle handlers (requirements §3.2.1). */
import {
  BLOCKS,
  isContainer,
  pointer,
  slotLabels,
  type AppDefinition,
  type Page,
  type Problem,
} from '@platon/definition'

const BANNED: [RegExp, string][] = [
  [/\bfetch\s*\(/, 'fetch() is not available — call a Logic function with ctx.call()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest is not available — use ctx.call()'],
  [/\b(document|window)\s*\./, 'The page sandbox has no DOM — change blocks through ctx.blocks'],
  [/\beval\s*\(|\bnew\s+Function\b/, 'Dynamic code is not allowed'],
]

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split('\n').length
}

/** Problems inside one page script; `line` is 1-based within `source`. */
export function scriptProblems(page: Page, source: string, def: AppDefinition, path: string): Problem[] {
  const out: Problem[] = []
  const refs = new Map(page.blocks.map((b) => [b.ref, b]))
  const fns = new Set(def.logic.functions.map((f) => f.name))

  for (const [re, msg] of BANNED) {
    const m = re.exec(source)
    if (m) out.push({ severity: 'error', code: 'sandbox', message: msg, path, line: lineOf(source, m.index) })
  }
  for (const m of source.matchAll(/ctx\.blocks\.([A-Za-z_]\w*)/g))
    if (!refs.has(m[1]!))
      out.push({
        severity: 'error',
        code: 'unknown_block',
        message: `No block “${m[1]}” on this page`,
        path,
        line: lineOf(source, m.index!),
      })
  for (const m of source.matchAll(/ctx\.call\(\s*['"]([^'"]+)['"]/g))
    if (!fns.has(m[1]!))
      out.push({
        severity: 'error',
        code: 'unknown_function',
        message: `Function “${m[1]}” does not exist`,
        path,
        line: lineOf(source, m.index!),
      })
  for (const m of source.matchAll(/['"]([A-Za-z_]\w*)\.([A-Za-z]+)['"]\s*:/g)) {
    const b = refs.get(m[1]!)
    if (!b)
      out.push({
        severity: 'error',
        code: 'unknown_block',
        message: `Handler for unknown block “${m[1]}”`,
        path,
        line: lineOf(source, m.index!),
      })
    else if (!BLOCKS[b.type].events.includes(m[2]!))
      out.push({
        severity: 'error',
        code: 'unknown_event',
        message: `${BLOCKS[b.type].label} has no “${m[2]}” event${BLOCKS[b.type].events.length ? ` (try ${BLOCKS[b.type].events.join(', ')})` : ''}`,
        path,
        line: lineOf(source, m.index!),
      })
  }
  // Cheap syntax check: balanced brackets and quotes. Full parsing happens in Monaco and on the server.
  const stack: string[] = []
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  let quote: string | null = null
  let lineComment = false
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!
    if (lineComment) {
      if (ch === '\n') lineComment = false
      continue
    }
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && source[i + 1] === '/') lineComment = true
    else if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if ('([{'.includes(ch)) stack.push(ch)
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) {
        out.push({
          severity: 'error',
          code: 'syntax',
          message: `Unexpected “${ch}”`,
          path,
          line: lineOf(source, i),
        })
        break
      }
    }
  }
  if (stack.length && !out.some((p) => p.code === 'syntax'))
    out.push({
      severity: 'error',
      code: 'syntax',
      message: `Missing closing bracket for “${stack.at(-1)}”`,
      path,
      line: source.split('\n').length,
    })
  return out
}

export function validatePages(def: AppDefinition): Problem[] {
  const out: Problem[] = []
  const routes = new Map<string, string>()
  const ids = new Set(def.interface.pages.map((p) => p.id))
  const roleIds = new Set(def.roles.map((r) => r.id))
  for (const p of def.interface.pages) {
    const base = ['interface', 'pages', p.id]
    if (!p.route.startsWith('/'))
      out.push({
        severity: 'error',
        code: 'route',
        message: 'Route must start with “/”',
        path: pointer(...base, 'route'),
      })
    const other = routes.get(p.route)
    if (other)
      out.push({
        severity: 'error',
        code: 'route_taken',
        message: `Route ${p.route} is already used by “${other}”`,
        path: pointer(...base, 'route'),
      })
    routes.set(p.route, p.name)
    if (p.parent && !ids.has(p.parent))
      out.push({
        severity: 'error',
        code: 'parent',
        message: 'Parent page no longer exists',
        path: pointer(...base, 'parent'),
      })
    for (const r of p.visibleTo ?? [])
      if (!roleIds.has(r))
        out.push({
          severity: 'warning',
          code: 'role',
          message: `Unknown role “${r}”`,
          path: pointer(...base, 'visibleTo'),
        })
    const refs = new Set<string>()
    const byId = new Map(p.blocks.map((b) => [b.id, b]))
    for (const b of p.blocks) {
      if (b.parent) {
        const parent = byId.get(b.parent)
        const at = pointer(...base, 'blocks', b.id, 'parent')
        if (!parent || !isContainer(parent.type))
          out.push({
            severity: 'error',
            code: 'block_parent',
            message: `“${b.title ?? b.ref}” sits in a container that no longer exists`,
            path: at,
          })
        else if ((b.slot ?? 0) >= slotLabels(parent).length)
          out.push({
            severity: 'warning',
            code: 'block_slot',
            message: `“${b.title ?? b.ref}” is in a cell “${parent.title ?? parent.ref}” no longer has; it shows in the last one`,
            path: pointer(...base, 'blocks', b.id, 'slot'),
          })
        // A parent chain that loops back means the block can never render.
        const seen = new Set([b.id])
        for (let cur = parent; cur?.parent; cur = byId.get(cur.parent)) {
          if (seen.has(cur.parent)) {
            out.push({
              severity: 'error',
              code: 'block_cycle',
              message: `“${b.title ?? b.ref}” is nested inside itself`,
              path: at,
            })
            break
          }
          seen.add(cur.parent)
        }
      }
      if (refs.has(b.ref))
        out.push({
          severity: 'error',
          code: 'duplicate_ref',
          message: `Two blocks are called “${b.ref}”`,
          path: pointer(...base, 'blocks', b.id, 'ref'),
        })
      refs.add(b.ref)
      const src = (b.props as { source?: string }).source
      if (src && !def.data.tables.some((t) => t.id === src))
        out.push({
          severity: 'error',
          code: 'block_source',
          message: `“${b.title ?? b.ref}” reads from a table that no longer exists`,
          path: pointer(...base, 'blocks', b.id, 'props', 'source'),
        })
      if (b.type === 'custom' && !def.components.some((c) => c.id === b.component))
        out.push({
          severity: 'error',
          code: 'component_missing',
          message: 'This component no longer exists in the sandbox',
          path: pointer(...base, 'blocks', b.id),
        })
    }
    if (p.script) out.push(...scriptProblems(p, p.script.source, def, pointer(...base, 'script')))
    for (const [hook, handlers] of Object.entries(p.lifecycle ?? {}))
      for (const h of handlers) {
        const at = pointer(...base, 'lifecycle', hook, h.id)
        if (h.kind === 'function' && h.fn && !def.logic.functions.some((f) => f.name === h.fn))
          out.push({
            severity: 'error',
            code: 'unknown_function',
            message: `Function “${h.fn}” does not exist`,
            path: at,
          })
        if (h.kind === 'code' && h.code) out.push(...scriptProblems(p, h.code, def, at))
      }
  }
  return out
}
