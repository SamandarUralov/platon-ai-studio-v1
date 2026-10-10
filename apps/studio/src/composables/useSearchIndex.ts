/** Everything you can jump to in the current project — feeds the ⌘K palette. */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { LOGIC_KINDS, type LogicKind } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { projectLinks } from './useProject'

export interface SearchEntry {
  id: string
  label: string
  sub: string
  icon: string
  layer: string
  to: RouteLocationRaw
}

export const SETTINGS_SECTIONS: { id: string; label: string; icon: string; group: string }[] = [
  { id: 'general', label: 'General', icon: 'settings', group: 'Project' },
  { id: 'members', label: 'Members', icon: 'users', group: 'Project' },
  { id: 'auth', label: 'Sign-in & security', icon: 'key-round', group: 'Project' },
  { id: 'modules', label: 'Modules', icon: 'blocks', group: 'Project' },
  { id: 'workflows', label: 'Workflows', icon: 'workflow', group: 'App logic' },
  { id: 'translations', label: 'Translations', icon: 'languages', group: 'App logic' },
  { id: 'git', label: 'Git', icon: 'git-branch', group: 'Engineering' },
  { id: 'cicd', label: 'CI/CD', icon: 'rocket', group: 'Engineering' },
  { id: 'agent', label: 'Agent.md', icon: 'file-text', group: 'Studio AI' },
]

export function useSearchIndex() {
  const def = useDefinitionStore()
  return computed<SearchEntry[]>(() => {
    const d = def.definition
    const pid = def.projectId
    if (!d || !pid) return []
    const L = projectLinks(pid)
    const out: SearchEntry[] = []
    for (const p of d.interface.pages)
      out.push({
        id: `page:${p.id}`,
        label: p.name,
        sub: `Page · ${p.route}`,
        icon: p.icon,
        layer: 'interface',
        to: L.interface(p.id),
      })
    const logic: [LogicKind, { id: string; name?: string; path?: string; method?: string }[]][] = [
      ['functions', d.logic.functions],
      ['apis', d.logic.apis],
      ['crons', d.logic.crons],
      ['queues', d.logic.queues],
    ]
    for (const [kind, items] of logic)
      for (const it of items)
        out.push({
          id: `${kind}:${it.id}`,
          label: kind === 'apis' ? `${it.method} ${it.path}` : (it.name ?? it.id),
          sub: LOGIC_KINDS[kind].label.replace(/s$/, ''),
          icon: LOGIC_KINDS[kind].icon,
          layer: 'logic',
          to: L.logic(kind, it.id),
        })
    for (const t of d.data.tables)
      out.push({
        id: `table:${t.id}`,
        label: t.name,
        sub: `Table · ${t.id}`,
        icon: t.icon,
        layer: 'data',
        to: L.data(t.connection, t.id),
      })
    for (const s of d.storage.object)
      out.push({
        id: `storage:${s.id}`,
        label: s.name,
        sub: 'Object storage',
        icon: 'hard-drive',
        layer: 'storage',
        to: L.storage('object', s.id),
      })
    for (const f of d.storage.local.folders)
      out.push({
        id: `folder:${f.id}`,
        label: f.path,
        sub: 'Local folder',
        icon: 'folder',
        layer: 'storage',
        to: L.storage('local', f.id),
      })
    for (const c of d.components)
      out.push({
        id: c.id,
        label: c.name,
        sub: 'Custom component',
        icon: 'puzzle',
        layer: 'components',
        to: L.components(c.id.replace('component:', '')),
      })
    for (const s of SETTINGS_SECTIONS)
      out.push({
        id: `settings:${s.id}`,
        label: s.label,
        sub: `Settings · ${s.group}`,
        icon: s.icon,
        layer: 'settings',
        to: L.settings(s.id),
      })
    out.push({
      id: 'releases',
      label: 'Releases',
      sub: 'Changes and environments',
      icon: 'rocket',
      layer: 'releases',
      to: L.releases(),
    })
    out.push({
      id: 'advanced',
      label: 'App definition',
      sub: 'Advanced · JSON',
      icon: 'code-xml',
      layer: 'advanced',
      to: L.advanced(),
    })
    return out
  })
}
