/** Static catalogues for project settings (v4 mockup). Labels are i18n keys under `settings.*`. */
import type { Tone } from '@platon/ui'
import type { AuthProviderId, CiStageId } from '@platon/definition'

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
  ru: 'Русский',
  uz: 'Oʻzbekcha',
  de: 'Deutsch',
  fr: 'Français',
  tr: 'Türkçe',
  kk: 'Қазақша',
  ar: 'العربية',
  zh: '中文',
  pt: 'Português',
  it: 'Italiano',
}

export const languageLabel = (code: string) =>
  LANGUAGE_NAMES[code] ? `${LANGUAGE_NAMES[code]} · ${code}` : code

export const TIMEZONES = [
  'UTC',
  'Asia/Tashkent',
  'Asia/Almaty',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
]

/** App modules a project can switch on (definition.settings.modules). `core` ones are always on. */
export interface ModuleSpec {
  id: string
  icon: string
  version: string
  core?: boolean
  /** Usage hint shown under the description — which parts of the app rely on it. */
  usedBy?: (d: { tables: number; crons: number; apis: number; workflows: number }) => string | null
}

export const MODULES: ModuleSpec[] = [
  { id: 'auth', icon: 'users', version: '2.4.0', core: true },
  { id: 'db', icon: 'database', version: '3.1.2', core: true },
  {
    id: 'workflows',
    icon: 'workflow',
    version: '1.5.1',
    usedBy: (d) => (d.workflows ? `${d.workflows} workflow${d.workflows === 1 ? '' : 's'}` : null),
  },
  { id: 'reports', icon: 'chart-column', version: '2.1.0' },
  { id: 'notifications', icon: 'bell', version: '2.0.3' },
  { id: 'print_forms', icon: 'printer', version: '1.4.2' },
  { id: 'file_storage', icon: 'hard-drive', version: '1.8.0' },
  { id: 'audit_log', icon: 'history', version: '1.0.0' },
  {
    id: 'scheduler',
    icon: 'clock',
    version: '1.2.0',
    usedBy: (d) => (d.crons ? `${d.crons} cron${d.crons === 1 ? '' : 's'}` : null),
  },
  {
    id: 'integrations',
    icon: 'plug',
    version: '1.6.0',
    usedBy: (d) => (d.apis ? `${d.apis} endpoint${d.apis === 1 ? '' : 's'}` : null),
  },
  { id: 'comments', icon: 'message-square', version: '1.1.0' },
  { id: 'calendar', icon: 'calendar', version: '1.3.1' },
]

/** Older definitions (FieldOps seed) use short ids; they are normalised on the next toggle. */
export const MODULE_ALIASES: Record<string, string> = {
  files: 'file_storage',
  audit: 'audit_log',
  print: 'print_forms',
  api: 'integrations',
  notify: 'notifications',
  sched: 'scheduler',
}
export const normaliseModule = (id: string) => MODULE_ALIASES[id] ?? id

export interface ProviderSpec {
  id: AuthProviderId
  mono: string
  tone: Tone
  oauth: boolean
  /** [field, secret?, placeholder] */
  fields: { key: string; secret?: boolean; placeholder: string }[]
}

export const PROVIDERS: ProviderSpec[] = [
  {
    id: 'eimzo',
    mono: 'EI',
    tone: 'teal',
    oauth: false,
    fields: [
      { key: 'url', placeholder: 'https://eimzo.example.uz/backend' },
      { key: 'key', secret: true, placeholder: '' },
    ],
  },
  {
    id: 'ldap',
    mono: 'LD',
    tone: 'neutral',
    oauth: false,
    fields: [
      { key: 'url', placeholder: 'ldaps://dc01.example.local:636' },
      { key: 'bind', placeholder: 'CN=svc,DC=example,DC=local' },
      { key: 'pass', secret: true, placeholder: '' },
      { key: 'base', placeholder: 'OU=Staff,DC=example,DC=local' },
    ],
  },
  {
    id: 'oneid',
    mono: 'ID',
    tone: 'info',
    oauth: true,
    fields: [
      { key: 'cid', placeholder: 'client_id' },
      { key: 'secret', secret: true, placeholder: '' },
      { key: 'scope', placeholder: 'myportal' },
    ],
  },
  {
    id: 'google',
    mono: 'G',
    tone: 'danger',
    oauth: true,
    fields: [
      { key: 'cid', placeholder: '…apps.googleusercontent.com' },
      { key: 'secret', secret: true, placeholder: '' },
    ],
  },
  {
    id: 'rsid',
    mono: 'RS',
    tone: 'warn',
    oauth: true,
    fields: [
      { key: 'cid', placeholder: 'client_id' },
      { key: 'secret', secret: true, placeholder: '' },
    ],
  },
  {
    id: 'keycloak',
    mono: 'KC',
    tone: 'purple',
    oauth: true,
    fields: [
      { key: 'url', placeholder: 'https://sso.example.uz/realms/acme' },
      { key: 'cid', placeholder: 'fieldops' },
      { key: 'secret', secret: true, placeholder: '' },
    ],
  },
]

export const CI_STAGES: { id: CiStageId; icon: string }[] = [
  { id: 'validate', icon: 'list-checks' },
  { id: 'tests', icon: 'flask-conical' },
  { id: 'staging', icon: 'server' },
  { id: 'approval', icon: 'user-check' },
  { id: 'production', icon: 'globe' },
]

export const STATE_TONES: Tone[] = ['neutral', 'primary', 'info', 'teal', 'ok', 'warn', 'purple', 'danger']

export const AGENT_SNIPPETS: { id: string; text: string }[] = [
  { id: 'naming', text: '## Naming\n- Use “site” for a customer location.' },
  {
    id: 'data',
    text: '## Data rules\n- Every table needs an owner field.\n- Keep money in the Currency type.',
  },
  { id: 'tone', text: '## Copy tone\n- Use sentence case for labels and buttons.' },
  {
    id: 'donts',
    text: '## Don’ts\n- Don’t add pages without asking.\n- Don’t change Production access rules directly.',
  },
]
