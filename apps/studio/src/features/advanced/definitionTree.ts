/** Navigator tree over the app definition for the Advanced (JSON) view. Node ids are JSON pointers. */
import { getAt, pointer, LOGIC_KINDS, type AppDefinition, type LogicKind } from '@platon/definition'

export interface DefNode {
  /** JSON pointer, e.g. /interface/pages/orders/blocks/o3 */
  id: string
  label: string
  icon: string
  /** HTTP method / block type shown as a small tag. */
  tag?: string
  /** Section header (Interface, Logic, ...). */
  section?: boolean
  children?: DefNode[]
}

const n = (
  id: string,
  label: string,
  icon: string,
  children?: DefNode[],
  extra: Partial<DefNode> = {},
): DefNode => ({
  id,
  label,
  icon,
  ...(children ? { children } : {}),
  ...extra,
})

export function buildDefinitionTree(def: AppDefinition): DefNode[] {
  const pages = def.interface.pages.map((p) => {
    const base = pointer('interface', 'pages', p.id)
    const kids: DefNode[] = p.blocks.map((b) =>
      n(`${base}/blocks/${b.id}`, b.title || b.ref || b.id, 'square', undefined, { tag: b.type }),
    )
    if (p.script) kids.push(n(`${base}/script`, 'Page script', 'file-code'))
    if (p.lifecycle) kids.push(n(`${base}/lifecycle`, 'Lifecycle', 'refresh-cw'))
    return n(base, p.name, p.icon || 'file', kids)
  })
  const logic = (Object.keys(LOGIC_KINDS) as LogicKind[]).map((kind) => {
    const items = def.logic[kind] as { id: string; name?: string; method?: string; path?: string }[]
    return n(
      pointer('logic', kind),
      LOGIC_KINDS[kind].label,
      LOGIC_KINDS[kind].icon,
      items.map((it) =>
        kind === 'apis'
          ? n(pointer('logic', kind, it.id), it.path ?? it.id, LOGIC_KINDS[kind].icon, undefined, {
              tag: it.method,
            })
          : n(pointer('logic', kind, it.id), it.name ?? it.id, LOGIC_KINDS[kind].icon),
      ),
    )
  })
  return [
    n(
      '/interface',
      'Interface',
      'layout-panel-left',
      [n('/interface/navigation', 'Navigation', 'menu'), n('/interface/pages', 'Pages', 'files', pages)],
      { section: true },
    ),
    n('/logic', 'Logic', 'server-cog', logic, { section: true }),
    n(
      '/data',
      'Data',
      'database',
      [
        n(
          '/data/connections',
          'Connections',
          'plug',
          def.data.connections.map((c) =>
            n(pointer('data', 'connections', c.id), c.name, 'database', undefined, { tag: c.engine }),
          ),
        ),
        n(
          '/data/tables',
          'Tables',
          'table-2',
          def.data.tables.map((t) => n(pointer('data', 'tables', t.id), t.name, t.icon || 'table-2')),
        ),
      ],
      { section: true },
    ),
    n(
      '/storage',
      'Storage',
      'hard-drive',
      [
        n(
          '/storage/object',
          'Object storage',
          'cloud',
          def.storage.object.map((s) =>
            n(pointer('storage', 'object', s.id), s.name, 'cloud', undefined, { tag: s.provider }),
          ),
        ),
        n(
          '/storage/local',
          'Local folders',
          'folder',
          def.storage.local.folders.map((f) =>
            n(pointer('storage', 'local', 'folders', f.id), f.path, 'folder'),
          ),
        ),
      ],
      { section: true },
    ),
    n(
      '/workflows',
      'Workflows',
      'workflow',
      def.workflows.map((w) => n(pointer('workflows', w.id), w.name, 'workflow')),
      { section: true },
    ),
    n(
      '/settings',
      'Settings',
      'settings',
      [
        n(
          '/roles',
          'Roles',
          'shield',
          def.roles.map((r) => n(pointer('roles', r.id), r.name, 'user-round')),
        ),
        n('/translations', 'Translations', 'languages'),
        n(
          '/components',
          'Custom components',
          'puzzle',
          def.components.map((c) => n(pointer('components', c.id), c.name, 'puzzle')),
        ),
      ],
      { section: true },
    ),
  ]
}

/** Keep nodes whose label/tag/pointer matches, plus their ancestors. */
export function filterTree(nodes: DefNode[], query: string): DefNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const out: DefNode[] = []
  for (const node of nodes) {
    const hit =
      node.label.toLowerCase().includes(q) ||
      node.id.toLowerCase().includes(q) ||
      !!node.tag?.toLowerCase().includes(q)
    const kids = node.children ? filterTree(node.children, q) : []
    if (hit || kids.length)
      out.push({
        ...node,
        ...(node.children ? { children: hit && !kids.length ? node.children : kids } : {}),
      })
  }
  return out
}

/** Path of nodes from a root to the node with `id` (inclusive), or [] if absent. */
export function trail(nodes: DefNode[], id: string): DefNode[] {
  for (const node of nodes) {
    if (node.id === id) return [node]
    if (node.children) {
      const t = trail(node.children, id)
      if (t.length) return [node, ...t]
    }
  }
  return []
}

/** True if the pointer resolves in the definition (nodes can vanish after an edit elsewhere). */
export function exists(def: AppDefinition, id: string): boolean {
  return getAt(def, id) !== undefined
}

/**
 * Plain-language hints for definition keys, shown when hovering a key in the JSON.
 * Keyed by the property name; the most specific entry (`parent.key`) wins.
 */
export const KEY_DOCS: Record<string, string> = {
  id: 'Stable snake_case id. Other parts of the app refer to this, never to the display name.',
  name: 'Display name people see in Studio and in the app.',
  icon: 'Lucide icon name.',
  route: 'URL path of the page in the running app. :param segments come from the address.',
  parent: 'Parent page id — nests this page under another menu entry.',
  inMenu: 'Show this page in the app’s navigation menu.',
  visibleTo: 'Role ids allowed to open this page. Empty means everyone.',
  permissions: 'Per-role rights: view, create, edit, delete.',
  blocks: 'Building blocks of the page, top to bottom. Blocks with the same row sit side by side.',
  type: 'Kind of item; decides which other keys apply.',
  ref: 'camelCase handle page code uses: ctx.blocks.<ref>.',
  row: 'Layout row. Blocks with the same row share one line.',
  props: 'Settings specific to this block type (source, columns, filter...).',
  script: 'Page code. Runs in the app sandbox, never in Studio.',
  lifecycle: 'Steps that run when the page opens, loads data or closes.',
  steps: 'Function layers, run top to bottom. Branching steps keep children in branches.',
  params: 'Inputs the function accepts. Callers must pass the required ones.',
  returns: 'What the function gives back.',
  timeout: 'Hard limit for one run before it is stopped.',
  package: 'Folder this item is grouped under in the Logic layer.',
  method: 'HTTP method of the endpoint.',
  path: 'Address of the endpoint, relative to the app’s API base.',
  access: 'Who may call this: public, signed-in users, roles or API keys.',
  request: 'Shape of the request body and parameters.',
  responses: 'Possible responses by status code.',
  schedule: 'Cron expression in the given timezone.',
  timezone: 'IANA timezone used for schedules and dates.',
  enabled: 'Turned on in every environment when true.',
  consumers: 'Functions that process each message.',
  settings: 'App-wide settings: languages, theme, sign-in methods.',
  connection: 'Database connection id this table lives in.',
  connections: 'Databases the app talks to. Credentials are per environment.',
  physicalName: 'Name of the table in the database, if different from the id.',
  fields: 'Columns of the table. Changes here become migrations in the next release.',
  key: 'Column name in the database.',
  req: 'Required — a record can’t be saved without it.',
  unique: 'No two records may share this value.',
  link: 'Target table id for a link field.',
  options: 'Allowed values for select fields.',
  storage: 'Storage id where uploaded files are kept.',
  workflow: 'Workflow id that drives this status field.',
  engine: 'Database engine.',
  credentials: 'Secret references per environment (secret://...). Values are never shown.',
  buckets: 'Buckets created in each environment on release. Files never move between environments.',
  versioning: 'Keep previous versions of overwritten files.',
  folders: 'Server folders managed by the app, with quota and cleanup.',
  quota: 'Maximum size of the folder.',
  cleanup: 'Delete files older than this. Empty keeps them forever.',
  states: 'Workflow states, in order.',
  transitions: 'Allowed moves between states and which roles may make them.',
  roles: 'Roles people can have in the app.',
  translations: 'Language code → translation key → text.',
  version: 'Definition version; increases with every saved change.',
}

export function keyDoc(key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(KEY_DOCS, key) ? KEY_DOCS[key] : undefined
}
