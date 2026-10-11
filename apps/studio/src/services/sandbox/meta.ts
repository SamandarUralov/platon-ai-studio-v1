/**
 * App definition → Sandbox meta (the shape platon-sandbox renders).
 *
 * The definition keeps blocks flat (`row` + `parent`/`slot`); the Sandbox walks a tree of
 * `children`. Rows with several blocks become synthetic `row` nodes and container cells become
 * synthetic `column`/`card` nodes, so the result also carries a node map that turns the Sandbox's
 * `{ parentId, index }` drop locations and synthetic selections back into definition terms.
 *
 * Block types without a dedicated mapping are sent under their own name with their definition
 * props; the Sandbox has a built-in block for each of them.
 */
import {
  cellBlocks,
  isContainer,
  listProp,
  slotLabels,
  toRows,
  type AppDefinition,
  type Block,
  type Cell,
  type DropSide,
  type Page,
} from '@platon/definition'
import { appThemeVars, statsSource, STATS, translate, type RecordRow } from '@platon/renderer'
import type {
  SandboxBlock,
  SandboxLifecycle,
  SandboxMenuNode,
  SandboxPage,
  SandboxProjectMeta,
} from '@platon/bridge/sandbox'

/** Where a Sandbox node sits in definition terms. */
export type SandboxNode =
  /** The page itself, one container cell, or a single-cell container (`blockId`). */
  | { kind: 'cell'; cell: Cell; children: string[]; blockId?: string }
  /** Blocks sharing one definition row, side by side. */
  | { kind: 'row'; cell: Cell; children: string[] }
  /** A multi-cell container (or one grid row of it): drops go to the nearest cell. */
  | { kind: 'slots'; blockId: string; slots: number[] }
  /** A plain block, or a synthetic part of one (form fields, checkbox options). */
  | { kind: 'block'; blockId: string }

export interface SandboxBuild {
  meta: SandboxProjectMeta
  nodes: Map<string, SandboxNode>
}

export interface SandboxMetaOptions {
  /** Development records by table id; become the mock store's seed rows. */
  records?: Record<string, RecordRow[] | undefined>
  lang?: string
  prefersDark?: boolean
  /** Viewer name for "assigned to me" counters. */
  viewer?: string
  today?: string
}

/** Studio's empty role list means "nobody"; the Sandbox treats [] as everyone. */
const NOBODY = '~nobody'
const SEP = '~'

export const rootKey = (pageId: string) => `${SEP}page${SEP}${pageId}`

export function toSandboxMeta(def: AppDefinition, o: SandboxMetaOptions = {}): SandboxBuild {
  const nodes = new Map<string, SandboxNode>()
  const records = o.records ?? {}
  const today = o.today ?? new Date().toISOString().slice(0, 10)
  const tr = (b: Block, prop: string, text: string) => translate(def, o.lang, `block.${b.id}.${prop}`, text)

  function cellContent(page: Page, cell: Cell, key: string, slotCount?: number, row = false) {
    const blocks = cellBlocks(page.blocks, cell.parent, cell.slot ?? 0, slotCount)
    const rows = row ? (blocks.length ? [blocks] : []) : toRows(blocks)
    const out = rows.map((r, i) => {
      if (r.length === 1 && !row) return block(page, r[0]!)
      const id = `${key}${SEP}r${i}`
      nodes.set(id, { kind: 'row', cell, children: r.map((b) => b.id) })
      return { id, component: 'row', props: { gap: 16, wrap: true }, children: r.map((b) => block(page, b)) }
    })
    nodes.set(key, { kind: 'cell', cell, children: out.map((n) => n.id) })
    return out
  }

  function block(page: Page, b: Block): SandboxBlock {
    const roles = b.visibility?.roles
    const visible_to = roles ? (roles.length ? roles : [NOBODY]) : undefined
    const node = isContainer(b.type) ? container(page, b) : leaf(b)
    if (!nodes.has(b.id)) nodes.set(b.id, { kind: 'block', blockId: b.id })
    return visible_to ? { ...node, visible_to } : node
  }

  function container(page: Page, b: Block): SandboxBlock {
    const p = b.props as Record<string, unknown>
    const labels = slotLabels(b)
    const n = labels.length
    const cell = (slot: number): Cell => ({ parent: b.id, slot })
    const cellId = (slot: number) => `${b.id}${SEP}${slot}`
    const gap = GAP[String(p.gap ?? 'md')] ?? 16

    if (b.type === 'container' || b.type === 'section') {
      const children = cellContent(page, cell(0), cellId(0), 1, p.direction === 'row')
      // The block itself is the drop target for its only cell.
      nodes.set(b.id, { kind: 'cell', cell: cell(0), children: children.map((c) => c.id), blockId: b.id })
      return {
        id: b.id,
        component: 'card',
        props: {
          title: b.title ? tr(b, 'title', b.title) : undefined,
          subtitle: typeof p.subtitle === 'string' ? tr(b, 'subtitle', p.subtitle) : undefined,
          flat: b.type === 'section' || p.variant !== 'card',
        },
        children,
      }
    }

    const slots = Array.from({ length: n }, (_, i) => i)
    nodes.set(b.id, { kind: 'slots', blockId: b.id, slots })
    const column = (slot: number, props: Record<string, unknown> = { gap }): SandboxBlock => ({
      id: cellId(slot),
      component: 'column',
      props,
      children: cellContent(page, cell(slot), cellId(slot), n),
    })

    if (b.type === 'grid') {
      const cols = Math.max(1, Math.min(6, Math.round(Number(p.columns) || 2)))
      const gridRows = Math.ceil(n / cols)
      return {
        id: b.id,
        component: 'column',
        props: { gap },
        children: Array.from({ length: gridRows }, (_, r) => {
          const id = `${b.id}${SEP}g${r}`
          const rowSlots = slots.slice(r * cols, (r + 1) * cols)
          nodes.set(id, { kind: 'slots', blockId: b.id, slots: rowSlots })
          return { id, component: 'row', props: { gap }, children: rowSlots.map((s) => column(s)) }
        }),
      }
    }
    if (b.type === 'columns') {
      return { id: b.id, component: 'row', props: { gap }, children: slots.map((s) => column(s)) }
    }
    // tabs, accordion: one column per panel. The Sandbox stacks every panel in edit mode so all
    // cells stay droppable, and shows real tabs / an accordion in Preview.
    const panels = b.type === 'tabs' ? 'tabs' : 'panels'
    return {
      id: b.id,
      component: b.type,
      props: { ...p, title: b.title ? tr(b, 'title', b.title) : undefined, [panels]: labels, gap },
      children: slots.map((s) => column(s)),
    }
  }

  function leaf(b: Block): SandboxBlock {
    const p = b.props as Record<string, unknown>
    const title = b.title ? tr(b, 'title', b.title) : undefined
    const text = (k: string) => (typeof p[k] === 'string' ? tr(b, k, p[k] as string) : undefined)
    const source = typeof p.source === 'string' ? p.source : undefined
    const columns = listProp(p.columns)
    const query = source ? { table: source, ...(columns.length ? { columns } : {}) } : undefined
    const part = (i: number, component: string, props: Record<string, unknown>): SandboxBlock => {
      const id = `${b.id}${SEP}${i}`
      nodes.set(id, { kind: 'block', blockId: b.id })
      return { id, component, props }
    }
    const of = (
      component: string,
      props: Record<string, unknown> = {},
      extra: Partial<SandboxBlock> = {},
    ) => ({
      id: b.id,
      component,
      props: Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)),
      ...extra,
    })

    switch (b.type) {
      case 'header': {
        const label = text('buttonLabel')
        return of('page_header', {
          title,
          subtitle: text('subtitle'),
          actions: label ? [{ label, variant: 'primary' }] : undefined,
        })
      }
      case 'text':
        return of('text', { text: text('text') ?? title })
      case 'image':
        return of('image', { src: p.src, alt: title, caption: title })
      case 'button':
        return of('button', { label: text('label') ?? title, variant: p.variant })
      case 'stats': {
        const src = statsSource(def)
        const rows = (src && records[src]) || []
        const items = listProp(p.items)
          .filter((k) => STATS[k])
          .map((k) => ({
            label: STATS[k]!.label,
            value: STATS[k]!.count(rows, { def, today, viewer: o.viewer }),
          }))
        return of('stat_group', {}, { items })
      }
      case 'kpi':
        return of('numbers', {
          label: title,
          value: source ? (records[source]?.length ?? 0) : p.value,
          delta: p.delta,
          deltaType: typeof p.delta === 'string' && p.delta.startsWith('-') ? 'down' : 'up',
          hint: text('caption'),
        })
      case 'table':
        return of('data_table', { title }, query ? { query } : {})
      case 'form': {
        const fields = source ? def.data.tables.find((t) => t.id === source)?.fields : undefined
        const children = columns.map((key, i) => {
          const f = fields?.find((x) => x.key === key)
          return part(i, 'text_input', { label: f?.name ?? key })
        })
        return of('form', { title, submitLabel: text('submitLabel') }, { children })
      }
      case 'input':
        return of('text_input', {
          label: title,
          placeholder: text('placeholder'),
          type: p.variant,
          helperText: text('help'),
        })
      case 'textarea':
        return of('text_area', { label: title, placeholder: text('placeholder') })
      case 'select':
        return of('select', { options: listProp(p.options), placeholder: title })
      case 'radio':
        return of('radio_group', { label: title, options: listProp(p.options) })
      case 'checkbox': {
        const options = listProp(p.options)
        if (!options.length) return of('checkbox', { label: title })
        return of(
          'column',
          { gap: 8 },
          { children: options.map((l, i) => part(i, 'checkbox', { label: l })) },
        )
      }
      case 'switch':
        return of('switch', { label: text('text') ?? title })
      case 'date':
        return of('date_picker', { label: title, time: p.variant === 'datetime' })
      case 'upload':
        return of('file_upload', { label: title, multiple: p.multiple })
      case 'pagination':
        return of('pagination', { total: p.total, pageSize: p.pageSize })
      case 'custom': {
        const c = def.components.find((x) => x.id === b.component)
        return of(`custom:${c?.name ?? b.component ?? 'component'}`, p)
      }
      // The rest (list, detail, charts, widgets, badge, alert...) have a Sandbox block of the same
      // name that reads the definition props as they are.
      default: {
        const strings = Object.keys(p).filter((k) => typeof p[k] === 'string')
        return of(
          b.type,
          { ...p, ...Object.fromEntries(strings.map((k) => [k, text(k)])), title },
          query ? { query } : {},
        )
      }
    }
  }

  const pages: SandboxPage[] = def.interface.pages.map((page) => {
    const blocks = cellContent(page, {}, rootKey(page.id))
    return {
      id: page.id,
      label: page.name,
      path: page.route,
      parent: page.parent ?? null,
      in_menu: page.inMenu,
      ...(page.visibleTo?.length ? { visible_to: page.visibleTo } : {}),
      ...(page.lifecycle ? { lifecycle: lifecycle(page) } : {}),
      blocks,
    }
  })

  const meta: SandboxProjectMeta = {
    schemaVersion: 1,
    id: def.id,
    name: def.name,
    theme: { tokens: themeTokens(def, o.prefersDark) },
    roles: def.roles.map((r) => r.id),
    data_models: def.data.tables.map((t) => ({
      table: t.id,
      columns: t.fields.map((f) => ({ name: f.key, type: f.type })),
      ...(records[t.id] ? { seed: records[t.id] } : {}),
    })),
    // Custom component sources live in the Constructor, not in the definition (F14).
    custom_components: [],
    global_state: {},
    global_hooks: [],
    menu: menu(def.interface.pages),
    pages,
  }
  return { meta, nodes }
}

const GAP: Record<string, number> = { none: 4, sm: 8, md: 16, lg: 24 }

function lifecycle(page: Page): SandboxLifecycle {
  const out: Record<string, string> = {}
  for (const [hook, handlers] of Object.entries(page.lifecycle ?? {})) {
    const code = handlers
      .map((h) =>
        h.kind === 'code'
          ? (h.code ?? '')
          : `// "${h.fn}" is a Logic function; it runs in the Platon runtime, not in Preview.`,
      )
      .filter(Boolean)
      .join('\n')
    if (code) out[hook] = code
  }
  return out as SandboxLifecycle
}

function menu(pages: Page[]): SandboxMenuNode[] {
  const shown = pages.filter((p) => p.inMenu)
  const ids = new Set(shown.map((p) => p.id))
  const node = (p: Page): SandboxMenuNode => {
    const children = shown.filter((c) => c.parent === p.id).map(node)
    return {
      id: `menu${SEP}${p.id}`,
      label: p.name,
      page: p.id,
      icon: p.icon,
      ...(p.visibleTo?.length ? { visible_to: p.visibleTo } : {}),
      ...(children.length ? { children } : {}),
    }
  }
  return shown.filter((p) => !p.parent || !ids.has(p.parent)).map(node)
}

/** The app's own theme (definition settings), projected onto the Sandbox's `pl-*` tokens. */
function themeTokens(def: AppDefinition, prefersDark = false): Record<string, string> {
  const v = appThemeVars(def.settings.theme, prefersDark)
  const pick = (k: string) => v[k] ?? ''
  return {
    'pl-fg': pick('--app-fg'),
    'pl-fg-muted': pick('--app-muted'),
    'pl-border': pick('--app-line'),
    'pl-surface': pick('--app-surface'),
    'pl-bg': pick('--app-bg'),
    'pl-accent': pick('--app-accent'),
    'pl-danger': pick('--app-danger-fg'),
    'pl-success': pick('--app-ok-fg'),
    'pk-primary': pick('--pk-primary'),
  }
}

/** Definition block a Sandbox node belongs to (synthetic rows belong to none). */
export function ownerBlock(nodes: Map<string, SandboxNode>, id: string | null): string | null {
  if (!id) return null
  const n = nodes.get(id)
  if (!n) return null
  if (n.kind === 'row') return null
  if (n.kind === 'cell') return n.blockId ?? n.cell.parent ?? null
  return n.blockId
}

export interface Placement {
  target: string | null
  side: DropSide
  cell: Cell
}

/** A Sandbox drop location (`parentId` null = page root) as a definition placement. */
export function placementOf(
  nodes: Map<string, SandboxNode>,
  pageId: string,
  parentId: string | null,
  index: number,
): Placement | null {
  const n = nodes.get(parentId ?? rootKey(pageId))
  if (!n) return null
  switch (n.kind) {
    case 'cell': {
      const child = n.children[index]
      const first = child ? firstBlock(nodes, child) : null
      return first
        ? { target: first, side: 'before', cell: n.cell }
        : { target: null, side: 'after', cell: n.cell }
    }
    case 'row': {
      if (!n.children.length) return { target: null, side: 'after', cell: n.cell }
      return index < n.children.length
        ? { target: n.children[index]!, side: 'left', cell: n.cell }
        : { target: n.children.at(-1)!, side: 'right', cell: n.cell }
    }
    case 'slots': {
      const slot = n.slots[Math.min(index, n.slots.length - 1)] ?? 0
      return { target: null, side: 'after', cell: { parent: n.blockId, slot } }
    }
    case 'block':
      return { target: n.blockId, side: 'after', cell: {} }
  }
}

function firstBlock(nodes: Map<string, SandboxNode>, id: string): string | null {
  const n = nodes.get(id)
  if (!n) return null
  if (n.kind === 'row') return n.children[0] ?? null
  if (n.kind === 'cell') return n.blockId ?? null
  return n.blockId
}
