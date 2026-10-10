/**
 * Every Interface edit as a definition change (requirements §3.2): keys follow the definition path
 * so repeated tweaks of one setting collapse into a single pending change.
 */
import { useI18n } from 'vue-i18n'
import {
  BLOCKS,
  getAt,
  newId,
  placeBlock,
  uniqueName,
  type Block,
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

  function addBlock(page: Page, block: Block, target?: string | null, side: DropSide = 'after') {
    return setBlocks(
      page,
      placeBlock(page.blocks, block, target, side),
      t('interface.change.addBlock', { block: title(block), page: page.name }),
      `interface.pages.${page.id}.blocks.${block.id}`,
    )
  }

  function moveBlock(page: Page, id: string, target: string | null, side: DropSide) {
    const b = page.blocks.find((x) => x.id === id)
    if (!b || id === target) return false
    const next = placeBlock(page.blocks, b, target, side)
    if (
      JSON.stringify(next.map((x) => [x.id, x.row])) === JSON.stringify(page.blocks.map((x) => [x.id, x.row]))
    )
      return false
    return setBlocks(
      page,
      next,
      t('interface.change.moveBlock', { block: title(b), page: page.name }),
      `interface.pages.${page.id}.layout`,
    )
  }

  function duplicateBlock(page: Page, block: Block) {
    const copy: Block = {
      ...structuredClone(block),
      id: newId('blk'),
      ref: uniqueName(
        block.ref,
        page.blocks.map((b) => b.ref),
      ),
    }
    const rows = page.blocks.filter((b) => b.row === block.row)
    const last = rows[rows.length - 1]
    addBlock(page, copy, last?.id ?? block.id, 'after')
    return copy
  }

  function deleteBlock(page: Page, block: Block) {
    const key = `interface.pages.${page.id}.blocks.${block.id}`
    return def.apply({
      key,
      area: 'Pages',
      text: t('interface.change.deleteBlock', { block: title(block), page: page.name }),
      machinePath: `- ${key}`,
      ops: [{ op: 'remove', path: blockPath(page.id, block.id) }],
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
