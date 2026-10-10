/** Turning AI plans into definition changes. */
import {
  CHANGE_AREAS,
  type AiPlan,
  type AiPlanItem,
  type ChangeArea,
  type ChangeInput,
} from '@platon/definition'

/** The checked items of a plan, in plan order, as change inputs for `useDefinitionStore().apply`. */
export function planToChanges(plan: AiPlan, checked: ReadonlySet<string>): ChangeInput[] {
  return plan.items
    .filter((i) => checked.has(i.id))
    .map((i) => ({ ...i.change, ops: i.change.ops.map((op) => ({ ...op })) }))
}

/** Items grouped by change area, areas in catalog order. */
export function groupPlanItems(items: AiPlanItem[]): { area: ChangeArea; items: AiPlanItem[] }[] {
  const order = Object.keys(CHANGE_AREAS) as ChangeArea[]
  const map = new Map<ChangeArea, AiPlanItem[]>()
  for (const it of items) map.set(it.area, [...(map.get(it.area) ?? []), it])
  return [...map.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([area, list]) => ({ area, items: list }))
}
