/**
 * Static data for the New Project flow: the six questions, their options and defaults.
 * Labels live in locales/en.json (keyed by `ns` + option id) so this file stays language-neutral.
 */
import { ENGINES, type DbEngine } from '@platon/definition'

export type QuestionId = 'signin' | 'modules' | 'theme' | 'langs' | 'team' | 'data'
export type GroupKind = 'chips' | 'list' | 'swatch' | 'member' | 'engine'
export type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'reporter' | 'planner' | 'guest'

export interface OptionDef {
  id: string
  /** lucide kebab-case icon (list rows, engine cards). */
  icon?: string
}

export interface GroupDef {
  key: string
  kind: GroupKind
  /** i18n namespace for option labels: `newProject.opt.<ns>.<id>`. */
  ns: string
  multi?: boolean
  /** Show a group heading (only questions with several groups do). */
  labelled?: boolean
  options: OptionDef[]
}

export type Selection = Record<string, string | string[]>

export interface QuestionDef {
  id: QuestionId
  icon: string
  groups: GroupDef[]
  defaults: Selection
}

/**
 * Brand colours offered for the generated app. These are user data (they end up in the app's
 * theme), which is why they are raw hex rather than Studio tokens.
 */
export const BRAND_COLORS = [
  { id: 'indigo', hex: '#4f5bea' },
  { id: 'graphite', hex: '#2a2c3f' },
  { id: 'forest', hex: '#0e7c66' },
  { id: 'ember', hex: '#d9541e' },
  { id: 'ocean', hex: '#0a7bbf' },
  { id: 'plum', hex: '#8a3fb8' },
] as const

export const brandHex = (id: string | undefined) =>
  BRAND_COLORS.find((c) => c.id === id)?.hex ?? BRAND_COLORS[0].hex

export const PROJECT_ROLES: ProjectRole[] = [
  'owner',
  'maintainer',
  'developer',
  'reporter',
  'planner',
  'guest',
]
export const DEFAULT_ROLE: ProjectRole = 'developer'

/** Language option id → ISO code stored in the definition settings. */
export const LANGUAGE_CODES = ['en', 'uz', 'ru', 'kk', 'tr', 'de', 'ar'] as const

const MODULE_ICONS: Record<string, string> = {
  workflows: 'git-branch',
  reports: 'chart-column',
  notifications: 'bell',
  print_forms: 'printer',
  file_storage: 'hard-drive',
  audit_log: 'history',
  scheduler: 'clock',
  integrations: 'plug',
  comments: 'message-square',
  calendar: 'calendar',
}

export const RECOMMENDED_ENGINE: DbEngine = 'postgres'

export const QUESTIONS: QuestionDef[] = [
  {
    id: 'signin',
    icon: 'key-round',
    groups: [
      {
        key: 'v',
        kind: 'chips',
        ns: 'signin',
        multi: true,
        options: ['password', 'eimzo', 'ldap', 'oneid', 'rsid', 'keycloak', 'google'].map((id) => ({ id })),
      },
    ],
    defaults: { v: ['password', 'eimzo', 'oneid'] },
  },
  {
    id: 'modules',
    icon: 'blocks',
    groups: [
      {
        key: 'v',
        kind: 'list',
        ns: 'modules',
        multi: true,
        options: Object.entries(MODULE_ICONS).map(([id, icon]) => ({ id, icon })),
      },
    ],
    defaults: { v: ['workflows', 'reports', 'notifications', 'file_storage', 'audit_log'] },
  },
  {
    id: 'theme',
    icon: 'palette',
    groups: [
      {
        key: 'color',
        kind: 'swatch',
        ns: 'color',
        labelled: true,
        options: BRAND_COLORS.map((c) => ({ id: c.id })),
      },
      {
        key: 'mode',
        kind: 'chips',
        ns: 'mode',
        labelled: true,
        options: [{ id: 'light' }, { id: 'dark' }, { id: 'system' }],
      },
      {
        key: 'radius',
        kind: 'chips',
        ns: 'radius',
        labelled: true,
        options: [{ id: 'sharp' }, { id: 'soft' }, { id: 'round' }],
      },
    ],
    defaults: { color: 'indigo', mode: 'light', radius: 'soft' },
  },
  {
    id: 'langs',
    icon: 'languages',
    groups: [
      { key: 'v', kind: 'chips', ns: 'langs', multi: true, options: LANGUAGE_CODES.map((id) => ({ id })) },
    ],
    defaults: { v: ['en', 'uz', 'ru'] },
  },
  {
    id: 'team',
    icon: 'user-plus',
    // Options come from the directory API; the current user is added (and locked) at runtime.
    groups: [{ key: 'v', kind: 'member', ns: 'team', multi: true, options: [] }],
    defaults: { v: [] },
  },
  {
    id: 'data',
    icon: 'database',
    groups: [
      {
        key: 'engine',
        kind: 'engine',
        ns: 'engine',
        labelled: true,
        options: (Object.keys(ENGINES) as DbEngine[]).map((id) => ({ id, icon: ENGINES[id].icon })),
      },
      {
        key: 'storage',
        kind: 'chips',
        ns: 'storage',
        labelled: true,
        options: [{ id: 'new' }, { id: 'shared' }],
      },
      {
        key: 'sample',
        kind: 'chips',
        ns: 'sample',
        labelled: true,
        options: [{ id: 'sample' }, { id: 'empty' }],
      },
    ],
    defaults: { engine: RECOMMENDED_ENGINE, storage: 'new', sample: 'sample' },
  },
]

export const questionById = (id: QuestionId) => QUESTIONS.find((q) => q.id === id)!

/** What the generated FieldOps-style app gets; shown on the summary card and in build tasks. */
export const BLUEPRINT = {
  pages: ['Dashboard', 'Jobs', 'Job detail', 'Schedule', 'Map', 'Customers', 'Parts', 'Reports', 'Settings'],
  tables: ['job', 'customer', 'site', 'technician', 'part', 'time_entry', 'photo'],
  roles: ['Admin', 'Dispatcher', 'Technician', 'Customer'],
}

/** File type → short badge + tone, so attachments are colour-coded by kind. */
export type FileKind = 'doc' | 'pdf' | 'sheet' | 'image' | 'text' | 'other'
const EXT_KIND: Record<string, [FileKind, string]> = {
  docx: ['doc', 'DOC'],
  doc: ['doc', 'DOC'],
  pdf: ['pdf', 'PDF'],
  xlsx: ['sheet', 'XLS'],
  xls: ['sheet', 'XLS'],
  csv: ['sheet', 'CSV'],
  png: ['image', 'IMG'],
  jpg: ['image', 'IMG'],
  jpeg: ['image', 'IMG'],
  webp: ['image', 'IMG'],
  md: ['text', 'MD'],
  txt: ['text', 'TXT'],
}
export function fileKind(name: string): { kind: FileKind; badge: string } {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  const hit = EXT_KIND[ext]
  return hit ? { kind: hit[0], badge: hit[1] } : { kind: 'other', badge: 'FILE' }
}

export const ACCEPTED_FILES = '.docx,.doc,.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.md,.txt'

export const EXAMPLES = [
  { id: 'field', icon: 'wrench' },
  { id: 'purchase', icon: 'receipt' },
  { id: 'onboarding', icon: 'user-round-check' },
  { id: 'inspections', icon: 'clipboard-check' },
] as const
