/**
 * Every Interface edit as a definition change (requirements §3.2): keys follow the definition path
 * so repeated tweaks of one setting collapse into a single pending change.
 */
import { useI18n } from 'vue-i18n'
import {
  applySpans,
  BLOCKS,
  canPlaceIn,
  cellOf,
  descendantIds,
  getAt,
  newId,
  placeBlock,
  resizeInRow,
  rowOf,
  uniqueName,
  type Block,
  type Cell,
  type DropSide,
  type LifecycleHandler,
  type Page,
  type PagePermission,
  type PatchOp,
} from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { blockPath, pagePath, setOps } from '../lib/patch'

const show = (v: unknown) => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v))

export function useInterfaceEdits() {
  const def = useDefinitionStore()
  const { t } = useI18n()
  const title = (b: Block) => b.title || BLOCKS[b.type].label

  function blockField(page: Page, block: Block, segs: string[], value: unknown, label: string) {
    const doc = def.definition
    if (!doc) return false
    const ops = setOps(doc, blockPath(page.id, block.id), segs, value)
    if (!ops.length) return true
    const key = `interface.pages.${page.id}.blocks.${block.id}.${segs.join('.')}`
    return def.apply({
      key,
      area: 'Pages',
      text: t('interface.change.blockField', { label, block: title(block) }),
      machinePath: `~ ${key} = ${show(value)}`,
      ops,
    })
  }

  function setBlocks(page: Page, blocks: Block[], text: string, key = `interface.pages.${page.id}.blocks`) {
    return def.apply({
      key,
      area: 'Pages',
      text,
      machinePath: `~ ${key}`,
      ops: [{ op: 'replace', path: pagePath(page.id, 'blocks'), value: blocks }],
    })
  }

  /** Add next to `target` (joining its cell), or as the last row of `cell` / the page. */
  function addBlock(page: Page, block: Block, target?: string | null, side: DropSide = 'after', cell?: Cell) {
    return setBlocks(
      page,
      placeBlock(page.blocks, block, target, side, cell),
      t('interface.change.addBlock', { block: title(block), page: page.name }),
      `interface.pages.${page.id}.blocks.${block.id}`,
    )
  }

  function moveBlock(page: Page, id: string, target: string | null, side: DropSide, cell?: Cell) {
    const b = page.blocks.find((x) => x.id === id)
    if (!b || id === target) return false
    const to = target ? page.blocks.find((x) => x.id === target) : undefined
    if (!canPlaceIn(page.blocks, id, to ? cellOf(to) : (cell ?? {}))) return false
    const next = placeBlock(page.blocks, b, target, side, cell)
    const shape = (bs: Block[]) => JSON.stringify(bs.map((x) => [x.id, x.row, x.parent, x.slot]))
    if (shape(next) === shape(page.blocks)) return false
    return setBlocks(
      page,
      next,
      t('interface.change.moveBlock', { block: title(b), page: page.name }),
      `interface.pages.${page.id}.layout`,
    )
  }

  /**
   * Give block `id` `span` of its row's 12 columns; neighbours that no longer fit go back to auto.
   * `undefined` makes the block itself auto again.
   */
  function resizeBlock(page: Page, id: string, span: number | undefined) {
    const b = page.blocks.find((x) => x.id === id)
    if (!b) return false
    const spans =
      span === undefined ? new Map([[id, undefined]]) : resizeInRow(rowOf(page.blocks, id), id, span)
    const next = applySpans(page.blocks, spans)
    if (next.every((x, i) => x === page.blocks[i])) return false
    return setBlocks(
      page,
      next,
      t('interface.change.resizeBlock', { block: title(b), page: page.name }),
      `interface.pages.${page.id}.blocks.${id}.span`,
    )
  }

  /** Copy a block below its row; a container is copied with everything inside it. */
  function duplicateBlock(page: Page, block: Block) {
    const refs = page.blocks.map((b) => b.ref)
    const ids = new Map<string, string>()
    const clone = (b: Block): Block => {
      const id = newId('blk')
      ids.set(b.id, id)
      const ref = uniqueName(b.ref, refs)
      refs.push(ref)
      return { ...structuredClone(b), id, ref }
    }
    // The copy gets a row of its own, where the original's width (sized against its neighbours)
    // would leave it oddly narrow.
    const { span: _span, ...copy } = clone(block)
    const inner = page.blocks
      .filter((b) => descendantIds(page.blocks, block.id).has(b.id))
      .map((b) => clone(b))
      .map((b) => ({ ...b, parent: ids.get(b.parent!) ?? b.parent }))
    const siblings = page.blocks.filter(
      (b) => b.row === block.row && b.parent === block.parent && (b.slot ?? 0) === (block.slot ?? 0),
    )
    const last = siblings[siblings.length - 1]
    setBlocks(
      page,
      [...placeBlock(page.blocks, copy, last?.id ?? block.id, 'after'), ...inner],
      t('interface.change.addBlock', { block: title(copy), page: page.name }),
      `interface.pages.${page.id}.blocks.${copy.id}`,
    )
    return copy
  }

  function deleteBlock(page: Page, block: Block) {
    const key = `interface.pages.${page.id}.blocks.${block.id}`
    return def.apply({
      key,
      area: 'Pages',
      text: t('interface.change.deleteBlock', { block: title(block), page: page.name }),
      machinePath: `- ${key}`,
      // A container takes the blocks inside it along.
      ops: [block.id, ...descendantIds(page.blocks, block.id)].map((id) => ({
        op: 'remove' as const,
        path: blockPath(page.id, id),
      })),
    })
  }

  function pageField(page: Page, segs: string[], value: unknown, text: string) {
    const doc = def.definition
    if (!doc) return false
    const ops = setOps(doc, pagePath(page.id), segs, value)
    if (!ops.length) return true
    const key = `interface.pages.${page.id}.${segs.join('.')}`
    return def.apply({
      key,
      area: segs[0] === 'permissions' || segs[0] === 'visibleTo' ? 'Permissions' : 'Pages',
      text,
      machinePath: `~ ${key} = ${show(value)}`,
      ops,
    })
  }

  function addPage(page: Page) {
    const key = `interface.pages.${page.id}`
    return def.apply({
      key,
      area: 'Pages',
      text: t('interface.change.addPage', { page: page.name }),
      machinePath: `+ ${key}`,
      ops: [{ op: 'add', path: pagePath(page.id), value: page }],
    })
  }

  function deletePage(page: Page) {
    const key = `interface.pages.${page.id}`
    const ops: PatchOp[] = [{ op: 'remove', path: pagePath(page.id) }]
    // Children move up to the deleted page's parent so they stay reachable.
    for (const c of def.definition?.interface.pages.filter((p) => p.parent === page.id) ?? [])
      ops.unshift(
        page.parent
          ? { op: 'replace', path: pagePath(c.id, 'parent'), value: page.parent }
          : { op: 'remove', path: pagePath(c.id, 'parent') },
      )
    return def.apply({
      key,
      area: 'Pages',
      text: t('interface.change.deletePage', { page: page.name }),
      machinePath: `- ${key}`,
      ops,
    })
  }

  function duplicatePage(page: Page): Page | null {
    const pages = def.definition?.interface.pages ?? []
    const id = uniqueName(
      `${page.id}_copy`,
      pages.map((p) => p.id),
    )
    const routes = pages.map((p) => p.route)
    let route = `${page.route.replace(/\/$/, '')}-copy`
    for (let i = 2; routes.includes(route); i++) route = `${page.route.replace(/\/$/, '')}-copy-${i}`
    const copy: Page = {
      ...structuredClone(page),
      id,
      name: t('interface.copyOf', { name: page.name }),
      route,
      blocks: page.blocks.map((b) => ({ ...b, id: newId('blk') })),
    }
    if (copy.script) copy.script = { ...copy.script, file: `pages/${id}.page.js` }
    return addPage(copy) ? copy : null
  }

  function setLifecycle(page: Page, hook: string, handlers: LifecycleHandler[], text: string) {
    const doc = def.definition
    if (!doc) return false
    const value = handlers.length ? handlers : undefined
    const ops = setOps(doc, pagePath(page.id), ['lifecycle', hook], value)
    if (!ops.length) return true
    const key = `interface.pages.${page.id}.lifecycle.${hook}`
    return def.apply({ key, area: 'Pages', text, machinePath: `~ ${key}`, ops })
  }

  function setPermission(page: Page, role: string, action: keyof PagePermission, on: boolean) {
    const cur = page.permissions?.[role] ?? {
      view: true,
      create: role === 'admin',
      edit: role === 'admin',
      delete: role === 'admin',
    }
    const next = { ...cur, [action]: on }
    if (action === 'view' && !on) Object.assign(next, { create: false, edit: false, delete: false })
    if (action !== 'view' && on) next.view = true
    const roleName = def.definition?.roles.find((r) => r.id === role)?.name ?? role
    return pageField(
      page,
      ['permissions', role],
      next,
      t('interface.change.permission', {
        role: roleName,
        action: t(`interface.perm.${action}`).toLowerCase(),
        page: page.name,
        state: on ? t('interface.allowed') : t('interface.denied'),
      }),
    )
  }

  /** Create the page script so drafts have something to edit (drafts only edit existing values). */
  function ensureScript(page: Page, source: string) {
    if (page.script) return true
    const key = `interface.pages.${page.id}.script`
    return def.apply({
      key,
      area: 'Pages',
      text: t('interface.change.createScript', { page: page.name }),
      machinePath: `+ ${key}`,
      ops: [
        {
          op: 'add',
          path: pagePath(page.id, 'script'),
          value: { lang: 'js', file: `pages/${page.id}.page.js`, source },
        },
      ],
    })
  }

  const exists = (path: string) => !!def.definition && getAt(def.definition, path) !== undefined

  return {
    blockField,
    setBlocks,
    addBlock,
    moveBlock,
    resizeBlock,
    duplicateBlock,
    deleteBlock,
    pageField,
    addPage,
    deletePage,
    duplicatePage,
    setLifecycle,
    setPermission,
    ensureScript,
    exists,
  }
}
