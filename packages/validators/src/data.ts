import { pointer, type AppDefinition, type Problem } from '@platon/definition'

export function validateData(def: AppDefinition): Problem[] {
  const out: Problem[] = []
  const tables = new Set(def.data.tables.map((t) => t.id))
  const conns = new Set(def.data.connections.map((c) => c.id))
  const storages = new Set(def.storage.object.map((s) => s.id))
  for (const t of def.data.tables) {
    const base = ['data', 'tables', t.id]
    if (!conns.has(t.connection))
      out.push({
        severity: 'error',
        code: 'connection',
        message: 'Database connection no longer exists',
        path: pointer(...base, 'connection'),
      })
    const keys = new Set<string>()
    for (const f of t.fields) {
      if (keys.has(f.key))
        out.push({
          severity: 'error',
          code: 'duplicate_field',
          message: `Two fields use the key “${f.key}”`,
          path: pointer(...base, 'fields', f.key),
        })
      keys.add(f.key)
      if (f.type === 'link' && (!f.link || !tables.has(f.link)))
        out.push({
          severity: 'error',
          code: 'link_target',
          message: `“${f.name}” links to a table that does not exist`,
          path: pointer(...base, 'fields', f.key),
        })
      if (f.type === 'file' && f.storage && !storages.has(f.storage))
        out.push({
          severity: 'error',
          code: 'file_storage',
          message: `“${f.name}” stores files in a storage that does not exist`,
          path: pointer(...base, 'fields', f.key),
        })
    }
  }
  return out
}
