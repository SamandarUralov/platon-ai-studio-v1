/** Project settings seed (v4 mockup: auth, git, ci, runs, Agent.md). Secret values stay server-side. */
import type { AgentDoc, AuthSettings, CiResponse, GitResponse } from '@platon/definition'

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const DAY = 60 * 24

export interface AuthState {
  settings: AuthSettings
  /** Secret values by provider → field. Never returned to the browser. */
  secretValues: Record<string, Record<string, string>>
}

export function seedAuth(projectId: string): AuthState {
  const fieldops = projectId === 'fieldops'
  return {
    settings: {
      methods: { magicLink: false },
      providers: {
        eimzo: {
          fields: fieldops ? { url: 'https://eimzo.acme.uz/backend' } : {},
          secrets: { key: fieldops },
          defaultRole: 'dispatcher',
        },
        ldap: {
          fields: fieldops
            ? {
                url: 'ldaps://dc01.acme.local:636',
                bind: 'CN=platon-svc,OU=Service,DC=acme,DC=local',
                base: 'OU=Staff,DC=acme,DC=local',
              }
            : {},
          secrets: { pass: fieldops },
          defaultRole: 'technician',
        },
        oneid: {
          fields: fieldops ? { cid: 'fieldops_acme', scope: 'myportal' } : {},
          secrets: { secret: fieldops },
          defaultRole: 'customer',
        },
        google: {
          fields: fieldops ? { cid: '4821-fieldops.apps.googleusercontent.com' } : {},
          secrets: { secret: false },
          defaultRole: 'customer',
        },
        rsid: { fields: {}, secrets: { secret: false }, defaultRole: 'customer' },
        keycloak: { fields: {}, secrets: { secret: false }, defaultRole: 'customer' },
      },
      signup: 'invite',
      mfa: 'staff',
      session: '8h',
      lockout: '5_15m',
      allowedDomains: ['acme-facilities.com'],
    },
    secretValues: fieldops
      ? { eimzo: { key: 'demo' }, ldap: { pass: 'demo' }, oneid: { secret: 'demo' } }
      : {},
  }
}

export function seedGit(projectId: string): GitResponse {
  return {
    config: {
      connected: false,
      provider: 'github',
      repo: `acme-facilities/${projectId.replace(/_/g, '-')}-app`,
      branch: 'main',
      path: '/platon',
      autoCommit: true,
      openPr: true,
      lastSyncAt: null,
    },
    commits:
      projectId === 'fieldops'
        ? [
            {
              hash: 'a91c3e2',
              message: 'Release v1.4 · Parts used table, Technicians page',
              by: 'Platon Studio',
              at: ago(DAY * 9),
            },
            {
              hash: '7d02bb4',
              message: 'Release v1.3 · Customer role and visibility',
              by: 'Platon Studio',
              at: ago(DAY * 27),
            },
            {
              hash: '1c88f0a',
              message: 'Release v1.2 · Work order workflow',
              by: 'Platon Studio',
              at: ago(DAY * 38),
            },
          ]
        : [],
  }
}

export interface CiState extends CiResponse {
  secretValues: Record<string, string>
}

export function seedCi(projectId: string, slug: string, timezone: string): CiState {
  return {
    config: {
      trigger: 'release',
      stages: { validate: true, tests: true, staging: true, approval: true, production: true },
    },
    runs:
      projectId === 'fieldops'
        ? [
            {
              n: 41,
              title: 'Release v1.4 → Production',
              status: 'passed',
              detail: '3m 12s',
              at: ago(DAY * 9),
            },
            { n: 40, title: 'Release v1.4 → Staging', status: 'passed', detail: '2m 54s', at: ago(DAY * 10) },
            {
              n: 39,
              title: 'Release v1.4-rc → Staging',
              status: 'failed',
              detail: '2 tests failed',
              at: ago(DAY * 10 + 90),
            },
            {
              n: 38,
              title: 'Release v1.3 → Production',
              status: 'passed',
              detail: '3m 05s',
              at: ago(DAY * 27),
            },
          ]
        : [],
    variables: [
      { key: 'MINIO_FIELD_FILES_KEY', secret: true, set: true },
      { key: 'MINIO_BACKUPS_KEY', secret: true, set: true },
      { key: 'APP_BASE_URL', secret: false, value: `https://${slug}.platon.app` },
      { key: 'DEFAULT_TIMEZONE', secret: false, value: timezone },
    ],
    secretValues: { MINIO_FIELD_FILES_KEY: 'demo', MINIO_BACKUPS_KEY: 'demo' },
  }
}

export function seedAgent(name: string): AgentDoc {
  return {
    content: `# ${name} — notes for Studio AI

## About this app
Technicians use it on phones, often with gloves and poor signal. Keep screens short and buttons large.

## Naming
- Call jobs “work orders”, never “tickets”.
- Customers are companies, not people.

## Rules
- Never show customer contact details to Technicians.
- New fields on Work orders are optional unless I say otherwise.
- Ask before deleting any field, table or page.

## Copy tone
Plain, friendly English. Short labels. No exclamation marks.
`,
    updatedAt: ago(DAY * 3),
    updatedBy: 'Maya Chen',
  }
}

/** Tiny phrasebook so "AI translate" returns believable text for the demo languages. */
export const PHRASES: Record<string, Record<string, string>> = {
  es: {
    Dashboard: 'Panel',
    'Work orders': 'Órdenes de trabajo',
    Customers: 'Clientes',
    Technicians: 'Técnicos',
    'Open jobs': 'Trabajos abiertos',
    'Due today': 'Para hoy',
    'Waiting on parts': 'Esperando piezas',
    New: 'Nuevo',
    Scheduled: 'Programado',
    'In progress': 'En curso',
    Done: 'Hecho',
    Admin: 'Administrador',
    Dispatcher: 'Despachador',
    Technician: 'Técnico',
    Customer: 'Cliente',
    Invoices: 'Facturas',
    Parts: 'Piezas',
    Reports: 'Informes',
    Settings: 'Ajustes',
    'Work order': 'Orden de trabajo',
    Sites: 'Sitios',
    Schedule: 'Agenda',
  },
  ru: {
    Dashboard: 'Панель',
    'Work orders': 'Заявки',
    Customers: 'Клиенты',
    Technicians: 'Техники',
    'Open jobs': 'Открытые работы',
    New: 'Новая',
    Scheduled: 'Запланирована',
    'In progress': 'В работе',
    Done: 'Готово',
    'Waiting on parts': 'Ждёт запчасти',
    Admin: 'Администратор',
    Customer: 'Клиент',
  },
  uz: {
    Dashboard: 'Boshqaruv paneli',
    'Work orders': 'Ish buyurtmalari',
    Customers: 'Mijozlar',
    Technicians: 'Texniklar',
    New: 'Yangi',
    Scheduled: 'Rejalashtirilgan',
    'In progress': 'Jarayonda',
    Done: 'Bajarildi',
    'Waiting on parts': 'Ehtiyot qism kutilmoqda',
    Admin: 'Administrator',
    Customer: 'Mijoz',
  },
}
