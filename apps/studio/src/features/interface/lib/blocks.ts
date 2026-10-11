/** Defaults for new blocks and the element palette. */
import {
  BLOCK_GROUPS,
  BLOCKS,
  camel,
  cellBlocks,
  slotLabels,
  toRows,
  newId,
  uniqueName,
  type AppDefinition,
  type Block,
  type BlockMeta,
  type BlockType,
  type CustomComponent,
  type Page,
} from '@platon/definition'

/** Sensible starting props so a dropped block looks right before anyone edits it. */
export function defaultProps(
  type: BlockType,
  def: AppDefinition,
): { title?: string; props: Record<string, unknown> } {
  const t =
    def.data.tables.find(
      (x) => x.connection === def.data.connections.find((c) => c.role === 'primary')?.id,
    ) ?? def.data.tables[0]
  const cols = t?.fields.slice(0, 4).map((f) => f.key) ?? []
  const label = BLOCKS[type].label
  switch (type) {
    case 'header':
      return {
        title: 'Page title',
        props: { subtitle: 'What this page is for.', buttonLabel: '', buttonWho: 'everyone' },
      }
    case 'text':
      return { props: { text: 'Explain what people should do here.' } }
    case 'image':
      return { title: 'Image', props: {} }
    case 'button':
      return { title: 'Button', props: { label: 'Continue', action: 'none', variant: 'primary' } }
    case 'badge':
      return { props: { text: 'New', variant: 'primary', size: 'md' } }
    case 'spacer':
      return { props: { size: 24 } }
    case 'container':
      return { props: { variant: 'card', direction: 'column', gap: 'md', padding: 'md' } }
    case 'section':
      return {
        title: 'Section title',
        props: { subtitle: 'What this part of the page is for.', variant: 'plain', gap: 'md' },
      }
    case 'grid':
      return { props: { columns: 3, rows: 1, gap: 'md', stackOn: 'mobile' } }
    case 'columns':
      return { props: { ratio: '2:1', gap: 'md', align: 'stretch', stackOn: 'mobile' } }
    case 'accordion':
      return { props: { panels: ['General', 'Details', 'History'], open: 'first' } }
    case 'breadcrumb':
      return { props: { items: ['Home', 'Work orders', 'WO-1042'] } }
    case 'empty':
      return {
        title: 'Nothing here yet',
        props: { text: 'Create the first one to get started.', icon: 'inbox', buttonLabel: 'Create' },
      }
    case 'segmented':
      return {
        title: 'Priority',
        props: { options: ['Low', 'Normal', 'High'], variant: 'primary', outlined: true },
      }
    case 'richtext':
      return { title: 'Notes', props: { mode: 'edit', minHeight: 140 } }
    case 'kpi':
      return {
        title: t ? `All ${t.name.toLowerCase()}` : 'Open work orders',
        props: { source: t?.id, delta: '+12%', caption: 'vs last month', sparkline: true },
      }
    case 'gauge':
      return { title: 'Jobs done on time', props: { value: 72, max: 100, unit: '%' } }
    case 'divider':
      return { props: {} }
    case 'stats':
      return { props: { items: ['open', 'done'] } }
    case 'table':
      return {
        title: t ? `All ${t.name.toLowerCase()}` : label,
        props: { source: t?.id, columns: cols, filter: 'none' },
      }
    case 'list':
      return { title: t?.name ?? label, props: { source: t?.id, columns: cols.slice(0, 3), filter: 'none' } }
    case 'form':
      return {
        title: t ? `New ${t.name.toLowerCase().replace(/s$/, '')}` : label,
        props: { source: t?.id, columns: cols, submitLabel: 'Save' },
      }
    case 'detail':
      return { title: 'Details', props: { source: t?.id, columns: cols } }
    case 'input':
      return { title: 'Label', props: { variant: 'text', placeholder: '' } }
    case 'select':
    case 'radio':
    case 'checkbox':
      return { title: label, props: { options: ['Low', 'Normal', 'High', 'Urgent'] } }
    case 'switch':
      return { title: 'Notify the customer', props: { text: 'Send an SMS when the job is done' } }
    case 'tabs':
      return { props: { tabs: ['Details', 'Parts', 'Photos'], position: 'top' } }
    case 'date':
      return { title: 'Date', props: { variant: 'single' } }
    case 'upload':
      return { title: 'Attachments', props: { variant: 'dropzone', multiple: true } }
    case 'steps':
      return { props: { steps: ['Requested', 'Scheduled', 'In progress', 'Done'], current: 1 } }
    case 'alert':
      return { title: 'Heads up', props: { variant: 'warning', text: 'Something people should know.' } }
    case 'pagination':
      return { props: { variant: 'full', total: 128, pageSize: 10 } }
    case 'bar':
    case 'line':
    case 'donut':
    case 'calendar':
    case 'progress':
    case 'timeline':
      return { title: label, props: {} }
    default:
      return { title: label, props: {} }
  }
}

export function createBlock(
  type: BlockType,
  def: AppDefinition,
  page: Page,
  component?: CustomComponent,
): Block {
  const d = defaultProps(type, def)
  const base =
    type === 'header'
      ? 'pageHeader'
      : type === 'stats'
        ? 'numbers'
        : camel(component?.name ?? d.title ?? BLOCKS[type].label)
  const ref = uniqueName(
    base + (type === 'form' && !base.endsWith('Form') ? 'Form' : ''),
    page.blocks.map((b) => b.ref),
  )
  const title = component?.name ?? d.title
  return {
    id: newId('blk'),
    type,
    ref,
    row: 0,
    ...(title ? { title } : {}),
    props:
      type === 'custom' && component
        ? Object.fromEntries(
            component.props.filter((p) => p.default !== undefined).map((p) => [p.name, p.default]),
          )
        : d.props,
    ...(component ? { component: component.id } : {}),
  }
}

export interface PaletteItem {
  type: BlockType
  meta: BlockMeta
}

/** Palette groups filtered by a search query (label, hint and tags). */
export function paletteGroups(
  query: string,
): { id: BlockMeta['group']; label: string; kit: boolean; items: PaletteItem[] }[] {
  const q = query.trim().toLowerCase()
  const match = (m: BlockMeta) => !q || `${m.label} ${m.hint} ${m.tags ?? ''}`.toLowerCase().includes(q)
  return BLOCK_GROUPS.map((g) => {
    const items = (Object.entries(BLOCKS) as [BlockType, BlockMeta][])
      .filter(([, m]) => m.group === g.id && match(m))
      .map(([type, meta]) => ({ type, meta }))
    return { ...g, kit: items.some((i) => i.meta.kit), items }
  }).filter((g) => g.items.length)
}

/** "Row 2" style label for the page-components list (1-based within the block's cell, matches the canvas). */
export function rowLabelOf(blocks: Block[], id: string): number {
  const b = blocks.find((x) => x.id === id)
  const cell = b ? cellBlocks(blocks, b.parent, b.slot ?? 0) : blocks
  return toRows(cell).findIndex((r) => r.some((x) => x.id === id)) + 1 || cell.length
}

export interface LayerItem {
  block: Block
  depth: number
  /** Cell label inside the parent container (e.g. "Column 2"), when nested. */
  cell?: string
}

/** Page blocks as an indented tree in canvas order: rows, then each container's cells. */
export function layerTree(blocks: Block[]): LayerItem[] {
  const out: LayerItem[] = []
  const walk = (
    parent: string | undefined,
    slot: number,
    count: number | undefined,
    depth: number,
    cell?: string,
  ) => {
    for (const row of toRows(cellBlocks(blocks, parent, slot, count)))
      for (const b of row) {
        out.push({ block: b, depth, cell })
        const labels = slotLabels(b)
        labels.forEach((l, i) => walk(b.id, i, labels.length, depth + 1, labels.length > 1 ? l : undefined))
      }
  }
  walk(undefined, 0, undefined, 0)
  // Blocks whose container is gone still need a row here so they can be selected and fixed.
  const listed = new Set(out.map((x) => x.block.id))
  for (const b of blocks) if (!listed.has(b.id)) out.push({ block: b, depth: 0 })
  return out
}

export type MoveDir = 'up' | 'down' | 'left' | 'right'

/** The rows of the cell `id` sits in, and its row/column there. */
function rowsAround(blocks: Block[], id: string) {
  const b = blocks.find((x) => x.id === id)
  if (!b) return null
  const parent = b.parent ? blocks.find((x) => x.id === b.parent) : undefined
  const count = parent ? slotLabels(parent).length : undefined
  const rows = toRows(cellBlocks(blocks, b.parent, b.slot ?? 0, count))
  const r = rows.findIndex((row) => row.some((x) => x.id === id))
  if (r < 0) return null
  return { rows, r, c: rows[r]!.findIndex((x) => x.id === id) }
}

/**
 * Where the block toolbar's arrows move a block, within its own cell: left/right swap places in
 * the row; up/down leave a shared row first, then step over the neighbouring row.
 */
export function moveTarget(
  blocks: Block[],
  id: string,
  dir: MoveDir,
): { target: string; side: 'before' | 'after' | 'left' | 'right' } | null {
  const at = rowsAround(blocks, id)
  if (!at) return null
  const { rows, r, c } = at
  const row = rows[r]!
  if (dir === 'left') return c > 0 ? { target: row[c - 1]!.id, side: 'left' } : null
  if (dir === 'right') return c < row.length - 1 ? { target: row[c + 1]!.id, side: 'right' } : null
  // In a shared row, "before"/"after" a row-mate puts the block on its own row above/below it.
  const mate = row.find((x) => x.id !== id)
  if (dir === 'up') {
    const prev = mate ?? rows[r - 1]?.[0]
    return prev ? { target: prev.id, side: 'before' } : null
  }
  const next = mate ?? rows[r + 1]?.at(-1)
  return next ? { target: next.id, side: 'after' } : null
}

export function moveAbility(blocks: Block[], id: string): Record<MoveDir, boolean> {
  const can = (d: MoveDir) => !!moveTarget(blocks, id, d)
  return { up: can('up'), down: can('down'), left: can('left'), right: can('right') }
}
