/**
 * Visibility rules (requirements §3.2): who can open a page, who can see a block, and the optional
 * condition. Roles are role ids; `undefined` roles = everyone with page access, `[]` = nobody.
 */
import type { AppDefinition, Block, Page, PagePermission, VisibilityCondition } from '@platon/definition'
import type { RecordRow, Viewer } from './context'

export type PermAction = keyof PagePermission

export function canOpenPage(page: Page, role: string | undefined): boolean {
  if (!role) return true
  if (page.visibleTo?.length && !page.visibleTo.includes(role)) return false
  const perm = page.permissions?.[role]
  return perm ? perm.view : true
}

export function pagePermission(page: Page, role: string | undefined, action: PermAction): boolean {
  if (!canOpenPage(page, role)) return false
  if (!role) return true
  const perm = page.permissions?.[role]
  if (perm) return perm[action]
  return action === 'view' ? true : role === 'admin'
}

function eq(a: unknown, b: unknown): boolean {
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
}

export function evalCondition(cond: VisibilityCondition, values: Record<string, unknown>): boolean {
  const v = values[cond.field]
  switch (cond.op) {
    case 'eq':
      return eq(v, cond.value)
    case 'neq':
      return !eq(v, cond.value)
    case 'in':
      return (
        Array.isArray(cond.value)
          ? cond.value
          : String(cond.value ?? '')
              .split(',')
              .map((s) => s.trim())
      ).some((x) => eq(v, x))
    case 'empty':
      return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)
    case 'not_empty':
      return !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length))
    default:
      return true
  }
}

export function blockRoleAllowed(block: Block, role: string | undefined): boolean {
  const roles = block.visibility?.roles
  if (roles === undefined) return true
  if (!roles.length) return false
  return !role || roles.includes(role)
}

/** True when the condition filters records (its field belongs to the block's source table). */
export function isRecordCondition(def: AppDefinition, block: Block): boolean {
  const c = block.visibility?.condition
  const src = (block.props as { source?: string }).source
  if (!c || !src) return false
  return !!def.data.tables.find((t) => t.id === src)?.fields.some((f) => f.key === c.field)
}

export function viewerValues(viewer: Viewer | undefined, lang?: string): Record<string, unknown> {
  return { role: viewer?.role, user: viewer?.name, lang, ...(viewer?.vars ?? {}) }
}

/** Whether the block is drawn for this viewer (record conditions never hide the block itself). */
export function canSeeBlock(
  def: AppDefinition,
  block: Block,
  viewer: Viewer | undefined,
  lang?: string,
): boolean {
  if (!blockRoleAllowed(block, viewer?.role)) return false
  const c = block.visibility?.condition
  if (!c || isRecordCondition(def, block) || !viewer) return true
  return evalCondition(c, viewerValues(viewer, lang))
}

/** Apply a record-level condition to the rows a block shows. */
export function applyRecordCondition(def: AppDefinition, block: Block, rows: RecordRow[]): RecordRow[] {
  const c = block.visibility?.condition
  if (!c || !isRecordCondition(def, block)) return rows
  return rows.filter((r) => evalCondition(c, r))
}

/** Menu pages for a role: in-menu, openable, parents before children. */
export function menuPages(def: AppDefinition, role: string | undefined): Page[] {
  return def.interface.pages.filter((p) => p.inMenu !== false && canOpenPage(p, role))
}
