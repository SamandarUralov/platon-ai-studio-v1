/** Defaults for new blocks and the element palette. */
import {
  BLOCK_GROUPS,
  BLOCKS,
  camel,
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
      return { title: 'Button', props: { label: 'Continue', action: 'none' } }
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
      return { props: { tabs: ['Details', 'Parts', 'Photos'] } }
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

/** "Row 2" style label for the page-components list (1-based, matches the canvas). */
export function rowLabelOf(blocks: Block[], id: string): number {
  let row = 0
  let prev: number | null = null
  for (const b of blocks) {
    if (b.row !== prev) row++
    prev = b.row
    if (b.id === id) return row
  }
  return row
}
