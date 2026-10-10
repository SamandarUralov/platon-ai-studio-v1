/** Skills, templates and the context catalogue for the `/` and `@` menus (mockup SKILLS / TEMPLATES). */
import type { AppDefinition } from '@platon/definition'
import type { AiContext, PickGroup, PickItem } from './types'

export const SKILLS: { id: string; label: string; desc: string; icon: string }[] = [
  {
    id: 'create-page',
    label: 'create-page',
    desc: 'Vue page in src/pages — AI suggests a name',
    icon: 'layout-template',
  },
  { id: 'table', label: 'Add table', desc: 'Design a table with fields and links', icon: 'table-2' },
  {
    id: 'field',
    label: 'Add field',
    desc: 'Add a field and show it where needed',
    icon: 'text-cursor-input',
  },
  {
    id: 'workflow',
    label: 'Build workflow',
    desc: 'States, transitions and who can move them',
    icon: 'workflow',
  },
  {
    id: 'access',
    label: 'Set access rules',
    desc: 'Roles, record visibility, field permissions',
    icon: 'shield-check',
  },
  {
    id: 'translate',
    label: 'Translate app',
    desc: 'Add a language and draft translations',
    icon: 'languages',
  },
  {
    id: 'explain',
    label: 'Explain this page',
    desc: 'Plain-language summary of the page',
    icon: 'book-open',
  },
  {
    id: 'create-component',
    label: 'create-component',
    desc: 'Vue component and its property fields — AI suggests a name',
    icon: 'puzzle',
  },
]

export interface Template {
  label: string
  prompt: string
}

const T = {
  priority: {
    label: 'Priority & urgency',
    prompt: 'Add a priority to work orders. Urgent jobs need a due date.',
  },
  access: {
    label: 'Technician-only access',
    prompt: 'Technicians should only see work orders assigned to them.',
  },
  translate: { label: 'Multilingual app', prompt: 'Translate the app to Uzbek for our field team.' },
  page: { label: 'Equipment page', prompt: 'Create a page for equipment listing open jobs by due date.' },
  explainPage: { label: 'Explain this page', prompt: 'Explain what this page does and who can see it.' },
  explainFn: { label: 'Explain this function', prompt: 'Explain what this function does step by step.' },
  explainTable: { label: 'Explain this table', prompt: 'Explain the fields of this table.' },
  refresh: { label: 'Auto-refresh the table', prompt: 'Refresh the work orders table every 30 seconds.' },
  component: {
    label: 'Rating component',
    prompt: 'Create a component that shows a 1–5 star rating customers can click.',
  },
} satisfies Record<string, Template>

export const TEMPLATES: Template[] = [T.priority, T.access, T.translate, T.page]

/** Empty-chat suggestions that fit what the user is looking at. */
export function suggestionsFor(kind: AiContext['kind'] | undefined): Template[] {
  switch (kind) {
    case 'page':
    case 'block':
      return [T.explainPage, T.priority, T.page, T.access]
    case 'code':
      return [T.refresh, T.explainPage, T.priority]
    case 'function':
    case 'api':
    case 'cron':
    case 'queue':
      return [T.explainFn, T.priority, T.access]
    case 'table':
    case 'connection':
      return [T.explainTable, T.priority, T.translate]
    case 'component':
      return [T.component, T.page, T.explainPage]
    default:
      return TEMPLATES
  }
}

const CTX_ICON: Record<AiContext['kind'], string> = {
  project: 'box',
  page: 'file',
  block: 'square-dashed',
  function: 'braces',
  api: 'globe',
  cron: 'clock',
  queue: 'list-ordered',
  table: 'table-2',
  connection: 'database',
  storage: 'hard-drive',
  component: 'puzzle',
  code: 'file-code-2',
}

export const contextIcon = (k: AiContext['kind']) => CTX_ICON[k]

export function ctxItem(c: AiContext, desc: string, icon?: string): PickItem {
  return {
    kind: 'ctx',
    key: `ctx:${c.path ?? c.kind + ':' + c.label}`,
    label: c.label,
    desc,
    icon: icon ?? CTX_ICON[c.kind],
    context: c,
  }
}

/** Selection first, then pages, functions and tables from the definition. */
export function contextItems(def: AppDefinition | null, current: AiContext | null | undefined): PickItem[] {
  const out: PickItem[] = []
  if (current && current.kind !== 'project') out.push(ctxItem(current, 'Current selection'))
  if (!def) return out
  for (const p of def.interface.pages)
    out.push(
      ctxItem(
        { kind: 'page', path: `/interface/pages/${p.id}`, label: `Page: ${p.name}` },
        `${p.blocks.length} blocks · ${p.route}`,
        p.icon,
      ),
    )
  for (const f of def.logic.functions)
    out.push(
      ctxItem(
        { kind: 'function', path: `/logic/functions/${f.id}`, label: `Function: ${f.name}` },
        `${f.steps.length} steps · ${f.params.map((x) => x.name).join(', ') || 'no input'}`,
      ),
    )
  for (const t of def.data.tables)
    out.push(
      ctxItem(
        { kind: 'table', path: `/data/tables/${t.id}`, label: `Table: ${t.name}` },
        `${t.fields.length} fields · structure only`,
        t.icon,
      ),
    )
  // The selection may also be in the catalogue; keep the first (selection) entry.
  const seen = new Set<string>()
  return out.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)))
}

const match = (q: string) => (it: PickItem) =>
  !q ||
  it.label.toLowerCase().includes(q) ||
  (it.skill ?? '').includes(q) ||
  it.desc.toLowerCase().includes(q)

export function slashGroups(
  def: AppDefinition | null,
  current: AiContext | null | undefined,
  query: string,
  labels: { skills: string; context: string; templates: string },
): PickGroup[] {
  const q = query.toLowerCase()
  const skills: PickItem[] = SKILLS.map((s) => ({
    kind: 'skill',
    key: `skill:${s.id}`,
    label: s.label,
    desc: s.desc,
    icon: s.icon,
    cmd: `/${s.id}`,
    skill: s.id,
  }))
  const ctx = contextItems(def, current)
    .filter(match(q))
    .slice(0, q ? 8 : 4)
  const tpl: PickItem[] = TEMPLATES.map((t) => ({
    kind: 'tpl',
    key: `tpl:${t.label}`,
    label: t.label,
    desc: t.prompt,
    icon: 'file-text',
    prompt: t.prompt,
  }))
  return [
    { label: labels.skills, items: skills.filter(match(q)) },
    { label: labels.context, items: ctx },
    { label: labels.templates, items: tpl.filter(match(q)) },
  ].filter((g) => g.items.length)
}

export function atGroups(
  def: AppDefinition | null,
  current: AiContext | null | undefined,
  query: string,
  label: string,
): PickGroup[] {
  const q = query.toLowerCase()
  const items = contextItems(def, current).filter(match(q)).slice(0, 12)
  return items.length ? [{ label, items }] : []
}
