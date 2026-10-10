/** Change records: one atomic, human-readable edit of the definition (requirements §2, §5). */
import type { Change, ChangeArea, PatchOp } from './generated/change'
import { newId } from './ids'

export interface ChangeInput {
  key: string
  area: ChangeArea
  text: string
  ops: PatchOp[]
  machinePath?: string
}

export function makeChange(
  input: ChangeInput,
  author: string,
  baseVersion: number,
  authorKind: Change['authorKind'] = 'human',
): Change {
  return {
    id: newId('chg'),
    key: input.key,
    area: input.area,
    author,
    authorKind,
    text: input.text,
    machinePath: input.machinePath ?? `~ ${input.key}`,
    ops: input.ops,
    baseVersion,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Change log upsert: an unreleased change with the same key is replaced in place
 * (its ops are merged so the log still describes the full edit), otherwise appended.
 */
export function upsertChange(log: Change[], next: Change): Change[] {
  const i = log.findIndex((c) => c.key === next.key && !c.releaseId)
  if (i < 0) return [...log, next]
  const prev = log[i]!
  const merged: Change = {
    ...next,
    id: prev.id,
    ops: [...prev.ops, ...next.ops],
    baseVersion: prev.baseVersion,
  }
  return [...log.slice(0, i), merged, ...log.slice(i + 1)]
}

export function groupByArea(changes: Change[]): [ChangeArea, Change[]][] {
  const map = new Map<ChangeArea, Change[]>()
  for (const c of changes) {
    const list = map.get(c.area) ?? []
    list.push(c)
    map.set(c.area, list)
  }
  return [...map.entries()]
}
