/** Plain-language summary of a block's visibility ("Admins, Dispatchers · only when region is North"). */
import type { AppDefinition, Block } from '@platon/definition'

type T = (key: string, values?: Record<string, unknown>) => string

export function visibilitySummary(def: AppDefinition, b: Block, t: T): string {
  const v = b.visibility
  const roles = v?.roles
  let s = !roles
    ? t('interface.vis.sum.everyone')
    : !roles.length
      ? t('interface.vis.sum.nobody')
      : roles.map((r) => def.roles.find((x) => x.id === r)?.name ?? r).join(', ')
  const c = v?.condition
  if (c)
    s +=
      ` · ${t('interface.vis.sum.when', { field: c.field, op: t(`interface.vis.op.${c.op}`).toLowerCase(), value: c.op === 'empty' || c.op === 'not_empty' ? '' : String(c.value ?? '') })}`.trimEnd()
  return s
}

export function isRestricted(b: Block): boolean {
  return !!b.visibility?.roles || !!b.visibility?.condition
}
