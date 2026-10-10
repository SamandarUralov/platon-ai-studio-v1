/** Left-panel model: items of one Logic group arranged into (nested) packages. */
import type { Api, Cron, LogicFunction, LogicKind, LogicPackage, Queue } from '@platon/definition'

export type LogicItem = LogicFunction | Api | Cron | Queue

export interface NavEntry {
  kind: LogicKind
  id: string
  label: string
  /** Method/protocol badge for APIs. */
  badge?: string
  package?: string
}

export type NavRow =
  | { k: 'pkg'; key: string; pkg: LogicPackage; depth: number; count: number; open: boolean }
  | { k: 'item'; key: string; entry: NavEntry; depth: number }

/** Items may reference a package by id or (older definitions) by name. */
export function resolvePackage(ref: string | undefined, packages: LogicPackage[]): LogicPackage | undefined {
  if (!ref) return undefined
  return packages.find((p) => p.id === ref) ?? packages.find((p) => p.name === ref)
}

export function buildNavRows(
  entries: NavEntry[],
  packages: LogicPackage[],
  open: ReadonlySet<string>,
): NavRow[] {
  const byPkg = new Map<string, NavEntry[]>()
  const root: NavEntry[] = []
  for (const e of entries) {
    const p = resolvePackage(e.package, packages)
    if (p) byPkg.set(p.id, [...(byPkg.get(p.id) ?? []), e])
    else root.push(e)
  }
  const ids = new Set(packages.map((p) => p.id))
  // A package whose parent is gone shows at the top level instead of disappearing.
  const children = (parent: string | undefined) =>
    packages.filter((p) => (parent === undefined ? !p.parent || !ids.has(p.parent) : p.parent === parent))
  const total = (id: string): number =>
    (byPkg.get(id)?.length ?? 0) +
    packages.filter((p) => p.parent === id).reduce((n, p) => n + total(p.id), 0)

  const out: NavRow[] = []
  const walk = (parent: string | undefined, depth: number) => {
    for (const p of children(parent)) {
      const isOpen = open.has(p.id)
      out.push({ k: 'pkg', key: `p:${p.id}`, pkg: p, depth, count: total(p.id), open: isOpen })
      if (!isOpen) continue
      walk(p.id, depth + 1)
      for (const e of byPkg.get(p.id) ?? [])
        out.push({ k: 'item', key: `i:${e.id}`, entry: e, depth: depth + 1 })
    }
  }
  walk(undefined, 0)
  for (const e of root) out.push({ k: 'item', key: `i:${e.id}`, entry: e, depth: 0 })
  return out
}

/** Ids of a package and everything nested in it (for "can't move a package into itself"). */
export function packageSubtree(id: string, packages: LogicPackage[]): Set<string> {
  const out = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const p of packages)
      if (p.parent && out.has(p.parent) && !out.has(p.id)) {
        out.add(p.id)
        grew = true
      }
  }
  return out
}

export const PKG_KIND: Record<LogicKind, LogicPackage['kind']> = {
  functions: 'functions',
  apis: 'apis',
  crons: 'crons',
  queues: 'queues',
}
