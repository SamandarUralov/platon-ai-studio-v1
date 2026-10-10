/** Package operations (direct definition changes): create, rename, delete, move items/packages. */
import { useDefinitionStore } from '@/stores/definition'
import { useDraftsStore } from '@/stores/drafts'
import { markRaw } from 'vue'
import { newId, type LogicKind, type LogicPackage, type PatchOp } from '@platon/definition'
import { itemTitle, KIND_NOUN } from '../lib/items'
import { packageSubtree, PKG_KIND, type LogicItem } from '../lib/nav'

export function usePackages() {
  const def = useDefinitionStore()
  const drafts = useDraftsStore()

  const all = () => def.definition?.logic.packages ?? []

  function create(kind: LogicKind, name: string, parent?: string): LogicPackage | null {
    const clean = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
    if (!clean) return null
    const pkg: LogicPackage = {
      id: newId('pkg'),
      name: clean,
      kind: PKG_KIND[kind],
      ...(parent ? { parent } : {}),
    }
    const ops: PatchOp[] = def.definition?.logic.packages
      ? [{ op: 'add', path: '/logic/packages/-', value: pkg }]
      : [{ op: 'add', path: '/logic/packages', value: [pkg] }]
    return def.apply({
      key: `logic.packages.${pkg.id}`,
      area: 'Logic',
      text: `Created package “${clean}”`,
      ops,
    })
      ? pkg
      : null
  }

  function rename(id: string, name: string) {
    const clean = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
    const p = all().find((x) => x.id === id)
    if (!p || !clean || clean === p.name) return
    def.apply({
      key: `logic.packages.${id}.name`,
      area: 'Logic',
      text: `Renamed package “${p.name}” to “${clean}”`,
      ops: [{ op: 'replace', path: `/logic/packages/${id}/name`, value: clean }],
    })
  }

  /** Delete a package; its items and sub-packages move up one level. */
  function remove(kind: LogicKind, id: string) {
    const p = all().find((x) => x.id === id)
    const d = def.definition
    if (!p || !d) return
    const ops: PatchOp[] = []
    for (const it of d.logic[kind] as LogicItem[])
      if (it.package === p.id || it.package === p.name)
        ops.push(
          p.parent
            ? { op: 'replace', path: `/logic/${kind}/${it.id}/package`, value: p.parent }
            : { op: 'remove', path: `/logic/${kind}/${it.id}/package` },
        )
    for (const c of all())
      if (c.parent === id)
        ops.push(
          p.parent
            ? { op: 'replace', path: `/logic/packages/${c.id}/parent`, value: p.parent }
            : { op: 'remove', path: `/logic/packages/${c.id}/parent` },
        )
    ops.push({ op: 'remove', path: `/logic/packages/${id}` })
    def.apply({ key: `logic.packages.${id}.delete`, area: 'Logic', text: `Deleted package “${p.name}”`, ops })
  }

  /** Move an item into a package (or to the top level with `pkg` undefined). */
  function moveItem(kind: LogicKind, id: string, pkg: string | undefined) {
    const path = `/logic/${kind}/${id}`
    const it = def.get<LogicItem>(path)
    if (!it || (it.package ?? undefined) === pkg) return
    const target = pkg ? all().find((p) => p.id === pkg) : undefined
    const op: PatchOp = pkg
      ? { op: it.package === undefined ? 'add' : 'replace', path: `${path}/package`, value: pkg }
      : { op: 'remove', path: `${path}/package` }
    const ok = def.apply({
      key: `logic.${kind}.${id}.package`,
      area: 'Logic',
      text: `Moved ${KIND_NOUN[kind]} “${itemTitle(kind, it)}” ${target ? `to package “${target.name}”` : 'out of packages'}`,
      ops: [op],
    })
    // Keep an open draft in step, so saving it doesn't move the item back.
    if (ok && drafts.isDirty(path))
      drafts.edit<LogicItem>(path, (x) => {
        const next = { ...x }
        if (pkg) next.package = pkg
        else delete next.package
        return markRaw(next)
      })
  }

  function movePackage(id: string, parent: string | undefined) {
    const p = all().find((x) => x.id === id)
    if (!p || p.parent === parent || (parent && packageSubtree(id, all()).has(parent))) return
    const op: PatchOp = parent
      ? { op: p.parent ? 'replace' : 'add', path: `/logic/packages/${id}/parent`, value: parent }
      : { op: 'remove', path: `/logic/packages/${id}/parent` }
    def.apply({
      key: `logic.packages.${id}.parent`,
      area: 'Logic',
      text: `Moved package “${p.name}”`,
      ops: [op],
    })
  }

  return { create, rename, remove, moveItem, movePackage }
}
