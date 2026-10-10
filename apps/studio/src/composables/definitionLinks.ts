/**
 * Map a definition pointer (Problem.path, Change op path, Advanced tree node) to the Studio screen
 * that edits it. Used by Advanced ("Open in visual editor"), Releases and the Console.
 */
import type { RouteLocationRaw } from 'vue-router'
import { getAt, type AppDefinition, type Change, type LogicKind } from '@platon/definition'
import { projectLinks } from '@/composables/useProject'

const LOGIC: LogicKind[] = ['functions', 'apis', 'crons', 'queues']

function segments(path: string): string[] {
  return path
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
}

/** Element id at `/<parent>/<seg>` — resolves numeric indexes to the element's id. */
function idAt(def: AppDefinition | null, parent: string, seg: string | undefined): string | undefined {
  if (!seg || seg === '-') return undefined
  if (!def || !/^\d+$/.test(seg)) return seg
  const el = getAt<{ id?: string; name?: string }>(def, `${parent}/${seg}`)
  return el?.id ?? el?.name ?? seg
}

export interface StudioTarget {
  to: RouteLocationRaw
  /** Short name of the screen, e.g. "Interface". */
  layer: string
}

export function linkForPointer(
  projectId: string,
  path: string,
  def: AppDefinition | null,
): StudioTarget | null {
  const L = projectLinks(projectId)
  const s = segments(path)
  const [a, b, c] = s
  if (a === 'interface') {
    if (b === 'pages') return { to: L.interface(idAt(def, '/interface/pages', c)), layer: 'Interface' }
    return { to: L.interface(), layer: 'Interface' }
  }
  if (a === 'logic') {
    const kind = LOGIC.find((k) => k === b)
    if (kind) return { to: L.logic(kind, idAt(def, `/logic/${kind}`, c)), layer: 'Logic' }
    return { to: L.logic(), layer: 'Logic' }
  }
  if (a === 'data') {
    if (b === 'tables') {
      const id = idAt(def, '/data/tables', c)
      const table = def?.data.tables.find((t) => t.id === id)
      return { to: L.data(table?.connection, id), layer: 'Data' }
    }
    if (b === 'connections') return { to: L.data(idAt(def, '/data/connections', c)), layer: 'Data' }
    return { to: L.data(), layer: 'Data' }
  }
  if (a === 'storage') {
    if (b === 'object') return { to: L.storage('object', idAt(def, '/storage/object', c)), layer: 'Storage' }
    if (b === 'local')
      return {
        to: L.storage('local', s[2] === 'folders' ? idAt(def, '/storage/local/folders', s[3]) : undefined),
        layer: 'Storage',
      }
    return { to: L.storage(), layer: 'Storage' }
  }
  if (a === 'workflows') return { to: L.settings('workflows'), layer: 'Settings' }
  if (a === 'translations') return { to: L.settings('translations'), layer: 'Settings' }
  if (a === 'roles') return { to: L.settings('auth'), layer: 'Settings' }
  if (a === 'settings') return { to: L.settings('general'), layer: 'Settings' }
  if (a === 'components') return { to: L.components(idAt(def, '/components', b)), layer: 'Components' }
  return null
}

/** Pointer a change is about: its first op, else its upsert key (`a.b.c` → `/a/b/c`). */
export function changePointer(c: Pick<Change, 'ops' | 'key'>): string {
  const op = c.ops[0]
  if (op) return op.path.replace(/\/-$/, '')
  return '/' + c.key.split('.').join('/')
}
