/** "Active rules" chips for Preview: what limits this role on this page. */
import { BLOCKS, type AppDefinition, type Page } from '@platon/definition'
import { blockRoleAllowed, isRecordCondition, pagePermission } from '@platon/renderer'

type T = (key: string, values?: Record<string, unknown>) => string

export function activeRules(def: AppDefinition, page: Page, role: string, t: T): string[] {
  const out: string[] = []
  const cant = (['create', 'edit', 'delete'] as const).filter((a) => !pagePermission(page, role, a))
  if (cant.length === 3) out.push(t('preview.rule.readOnly'))
  else if (cant.length) out.push(t('preview.rule.cant', { actions: cant.join(', ') }))
  for (const b of page.blocks) {
    const name = b.title || BLOCKS[b.type].label
    if (!blockRoleAllowed(b, role)) out.push(t('preview.rule.hidden', { block: name }))
    else if (b.visibility?.condition) {
      const c = b.visibility.condition
      out.push(
        isRecordCondition(def, b)
          ? t('preview.rule.filtered', { block: name, field: c.field, value: String(c.value ?? '') })
          : t('preview.rule.when', { block: name, field: c.field, value: String(c.value ?? '') }),
      )
    }
  }
  return out
}
