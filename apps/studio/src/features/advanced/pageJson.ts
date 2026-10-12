/**
 * Advanced · edit one page as JSON. The text is checked against the definition contract and the
 * layout / reference rules the visual editor keeps on its own (unique ids and refs, containers and
 * their cells, tables and fields), so a pasted page can't leave the canvas in a state it can't draw.
 */
import { isContainer, slotLabels, type AppDefinition, type Block, type Page } from '@platon/definition'
import { validateDefinition } from '@platon/definition/validate'

/** One problem, as an i18n key under `advanced.edit.issue` plus its params. */
export interface PageIssue {
  key:
    | 'json'
    | 'notObject'
    | 'idChanged'
    | 'schema'
    | 'dupId'
    | 'dupRef'
    | 'noParent'
    | 'notContainer'
    | 'slot'
    | 'cycle'
    | 'noTable'
    | 'noField'
    | 'noRole'
    | 'routeTaken'
  params: Record<string, string | number>
}

export type PageCheck = { ok: true; page: Page } | { ok: false; issues: PageIssue[] }

const PAGE_POINTER = /^\/interface\/pages\/([^/]+)$/

/** Page id when the pointer names a whole page, else null. */
export function pageIdOf(pointer: string): string | null {
  return PAGE_POINTER.exec(pointer)?.[1] ?? null
}

export function checkPageJson(text: string, def: AppDefinition, pageId: string): PageCheck {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return fail({ key: 'json', params: { message: e instanceof Error ? e.message : String(e) } })
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail({ key: 'notObject', params: {} })
  const page = raw as Page
  if (page.id !== pageId) return fail({ key: 'idChanged', params: { id: pageId } })

  const index = def.interface.pages.findIndex((p) => p.id === pageId)
  const pages = def.interface.pages.map((p, i) => (i === index ? page : p))
  const res = validateDefinition({ ...def, interface: { ...def.interface, pages } })
  if (!res.ok) {
    // ajv paths use array indexes; show them relative to the page being edited.
    const prefix = `/interface/pages/${index}`
    return {
      ok: false,
      issues: res.issues.map((i) => ({
        key: 'schema' as const,
        params: {
          path: i.path.startsWith(prefix) ? i.path.slice(prefix.length) || '/' : i.path,
          message: i.message,
        },
      })),
    }
  }

  const issues = [...layoutIssues(page.blocks), ...referenceIssues(page, def)]
  return issues.length ? { ok: false, issues } : { ok: true, page }
}

function layoutIssues(blocks: Block[]): PageIssue[] {
  const out: PageIssue[] = []
  const byId = new Map<string, Block>()
  const refs = new Set<string>()
  for (const b of blocks) {
    if (byId.has(b.id)) out.push({ key: 'dupId', params: { id: b.id } })
    if (refs.has(b.ref)) out.push({ key: 'dupRef', params: { ref: b.ref } })
    byId.set(b.id, b)
    refs.add(b.ref)
  }
  for (const b of blocks) {
    if (!b.parent) continue
    const p = byId.get(b.parent)
    if (!p) {
      out.push({ key: 'noParent', params: { block: b.id, parent: b.parent } })
      continue
    }
    if (!isContainer(p.type)) {
      out.push({ key: 'notContainer', params: { block: b.id, parent: p.id, type: p.type } })
      continue
    }
    const count = slotLabels(p).length
    if ((b.slot ?? 0) >= count) out.push({ key: 'slot', params: { block: b.id, slot: b.slot ?? 0, count } })
    // A block inside its own descendant would never reach the page.
    const seen = new Set([b.id])
    for (let cur: Block | undefined = p; cur; cur = cur.parent ? byId.get(cur.parent) : undefined) {
      if (seen.has(cur.id)) {
        out.push({ key: 'cycle', params: { block: b.id } })
        break
      }
      seen.add(cur.id)
    }
  }
  return out
}

function referenceIssues(page: Page, def: AppDefinition): PageIssue[] {
  const out: PageIssue[] = []
  const roles = new Set(def.roles.map((r) => r.id))
  const used = [
    ...(page.visibleTo ?? []),
    ...Object.keys(page.permissions ?? {}),
    ...page.blocks.flatMap((b) => b.visibility?.roles ?? []),
  ]
  for (const role of new Set(used)) if (!roles.has(role)) out.push({ key: 'noRole', params: { role } })

  const taken = def.interface.pages.find((p) => p.id !== page.id && p.route === page.route)
  if (taken) out.push({ key: 'routeTaken', params: { route: page.route, page: taken.name } })

  for (const b of page.blocks) {
    const p = b.props as { source?: unknown; columns?: unknown }
    if (typeof p.source !== 'string' || !p.source) continue
    const table = def.data.tables.find((t) => t.id === p.source)
    if (!table) {
      out.push({ key: 'noTable', params: { block: b.ref, table: p.source } })
      continue
    }
    // `columns` means field keys only on data blocks; grid and columns use it for a count / ratio.
    if (!Array.isArray(p.columns)) continue
    for (const f of p.columns)
      if (!table.fields.some((x) => x.key === f))
        out.push({ key: 'noField', params: { block: b.ref, field: String(f), table: table.id } })
  }
  return out
}

const fail = (issue: PageIssue): PageCheck => ({ ok: false, issues: [issue] })
