/**
 * Page script effects in the Sandbox. Preview runs the page script in the Studio's page runtime
 * (a Worker, see @platon/renderer PageRuntime); the Sandbox only draws. Its block events come back
 * here as definition events (`<ref>.<event>`), and what the script changes on `ctx.blocks.<ref>`
 * (visible, disabled, label, rows, ...) goes out as `patch` messages on the affected blocks.
 */
import { BLOCKS, type AppDefinition, type Block, type BlockType, type Page } from '@platon/definition'
import type { BlockOverrides } from '@platon/renderer'
import type { SandboxBlock, SandboxPatch } from '@platon/bridge/sandbox'
import { toSandboxMeta, type SandboxMetaOptions } from './meta'

/** Sandbox component event names that differ from the definition's. */
const RENAME: Record<string, string> = { action: 'buttonClick', 'row-click': 'rowClick' }

/** The definition event a Sandbox component event stands for, or null when no handler can take it. */
export function definitionEvent(type: BlockType, event: string): string | null {
  const name = RENAME[event] ?? event
  return BLOCKS[type].events.includes(name) ? name : null
}

/** `page` with runtime overrides applied the way the renderer reads them: on top of title + props. */
export function withOverrides(page: Page, overrides: BlockOverrides): Page {
  if (!Object.keys(overrides).length) return page
  const blocks = page.blocks.map((b): Block => {
    const o = overrides[b.ref]
    if (!o) return b
    const { visible, title, ...props } = o
    const next: Block = { ...b, props: { ...(b.props as Record<string, unknown>), ...props } }
    if (typeof title === 'string') next.title = title
    if (visible === false) next.visibility = { ...b.visibility, roles: [] }
    return next
  })
  return { ...page, blocks }
}

/**
 * Patches that bring the Sandbox in line with the overrides: the full Sandbox props and visibility
 * of every overridden block. Whole values, so sending them again (after a re-init) is harmless.
 */
export function overridePatches(
  def: AppDefinition,
  page: Page,
  overrides: BlockOverrides,
  opts: SandboxMetaOptions = {},
): SandboxPatch[] {
  const ids = new Set(page.blocks.filter((b) => overrides[b.ref]).map((b) => b.id))
  if (!ids.size) return []
  const next = withOverrides(page, overrides)
  const pages = def.interface.pages.map((p) => (p.id === page.id ? next : p))
  const built = toSandboxMeta({ ...def, interface: { ...def.interface, pages } }, opts)
  const tree = built.meta.pages.find((p) => p.id === page.id)?.blocks ?? []
  const out: SandboxPatch[] = []
  const walk = (nodes: SandboxBlock[]) => {
    for (const n of nodes) {
      if (ids.has(n.id)) {
        out.push({ blockId: n.id, path: 'props', value: n.props ?? {} })
        out.push({ blockId: n.id, path: 'visible_to', value: n.visible_to })
      }
      walk(n.children ?? [])
    }
  }
  walk(tree)
  // Page order, not tree order, so the result is stable for a page.
  const order = page.blocks.map((b) => b.id)
  return out.sort((a, b) => order.indexOf(a.blockId) - order.indexOf(b.blockId))
}
