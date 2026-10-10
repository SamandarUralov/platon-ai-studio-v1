/** Admin panel seed (v4 mockup: ADM0, ADM_PERMS, SBX0). Secret values are kept apart from what the API returns. */
import type {
  AdminModuleGroup,
  AdminPermission,
  AdminRole,
  AdminStudioSettings,
  AdminUser,
  AiSettings,
  AuditEntry,
  DatabasesResponse,
  Sandbox,
} from '@platon/definition'

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const DAY = 60 * 24
const GB = 1024 ** 3
const MB = 1024 ** 2

export interface AdminState {
  v: number
  studio: AdminStudioSettings
  users: AdminUser[]
  permissions: AdminPermission[]
  roles: AdminRole[]
  /** Admin-only facts about org projects (owner, size); the list itself comes from db.projects. */
  projectMeta: Record<string, { owner: string; envs: number; sizeBytes: number; archived: boolean }>
  ai: AiSettings
  aiKeys: Record<string, string>
  databases: DatabasesResponse
  sandboxes: Sandbox[]
  /** Sandbox secret values: sandbox → env id → value; git tokens under "__git". */
  sandboxSecrets: Record<string, Record<string, string>>
  /** Sandbox → project → version that project runs (missing = derived default). */
  sandboxProjectVersions: Record<string, Record<string, string>>
  modules: AdminModuleGroup[]
  audit: AuditEntry[]
}

export const ADMIN_SCHEMA_V = 1

const PERMS: AdminPermission[] = [
  { id: 'projects.create', label: 'Create projects' },
  { id: 'projects.delete', label: 'Delete or archive projects' },
  { id: 'deploy.production', label: 'Release to Production' },
  { id: 'secrets.edit', label: 'Edit secrets and credentials' },
  { id: 'members.manage', label: 'Manage project members' },
  { id: 'ai.use', label: 'Use Studio AI' },
  { id: 'db.console', label: 'Run SQL in Development' },
  { id: 'admin.access', label: 'Open the Admin panel' },
]

function usageDays(): AiSettings['usage'] {
  // 30 days of believable token usage (millions), weekday-heavy.
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * DAY * 60_000)
    const weekend = d.getDay() === 0 || d.getDay() === 6
    const base = weekend ? 0.9 : 3.4
    const wave = Math.sin(i / 3.1) * 0.8 + ((i * 37) % 11) / 10
    const input = Math.max(0.3, +(base + wave).toFixed(2))
    return { date: d.toISOString().slice(0, 10), input, output: +(input * 0.13).toFixed(2) }
  })
}

export function seedAdmin(): AdminState {
  return {
    v: ADMIN_SCHEMA_V,
    studio: {
      name: 'Acme Platon Studio',
      url: 'studio.acme-facilities.com',
      language: 'en',
      timezone: 'Asia/Tashkent',
      smtp: 'smtp.acme-facilities.com:587',
      from: 'studio@acme-facilities.com',
      support: 'it-help@acme-facilities.com',
    },
    users: [
      {
        id: 'u_maya',
        name: 'Maya Chen',
        email: 'maya@acme-facilities.com',
        role: 'owner',
        projects: 6,
        lastActiveAt: ago(0),
        active: true,
      },
      {
        id: 'u_diego',
        name: 'Diego Ruiz',
        email: 'diego@acme-facilities.com',
        role: 'admin',
        projects: 4,
        lastActiveAt: ago(12),
        active: true,
      },
      {
        id: 'u_priya',
        name: 'Priya Nair',
        email: 'priya@acme-facilities.com',
        role: 'editor',
        projects: 3,
        lastActiveAt: ago(60),
        active: true,
      },
      {
        id: 'u_jordan',
        name: 'Jordan Lee',
        email: 'jordan@acme-facilities.com',
        role: 'editor',
        projects: 2,
        lastActiveAt: ago(DAY),
        active: true,
      },
      {
        id: 'u_aziz',
        name: 'Aziz Karimov',
        email: 'aziz@acme-facilities.com',
        role: 'viewer',
        projects: 1,
        lastActiveAt: ago(DAY * 8),
        active: true,
      },
      {
        id: 'u_sara',
        name: 'Sara Ito',
        email: 'sara@acme-facilities.com',
        role: 'editor',
        projects: 0,
        lastActiveAt: ago(DAY * 27),
        active: false,
      },
      {
        id: 'u_tom',
        name: 'Tom Avery',
        email: 'tom@cedarschools.org',
        role: 'viewer',
        projects: 1,
        lastActiveAt: ago(DAY * 41),
        active: true,
      },
    ],
    permissions: PERMS,
    roles: [
      { id: 'owner', name: 'Owner', builtin: true, permissions: PERMS.map((p) => p.id) },
      { id: 'admin', name: 'Admin', builtin: true, permissions: PERMS.map((p) => p.id) },
      {
        id: 'editor',
        name: 'Editor',
        builtin: true,
        permissions: ['projects.create', 'members.manage', 'ai.use', 'db.console'],
      },
      { id: 'viewer', name: 'Viewer', builtin: true, permissions: [] },
    ],
    projectMeta: {
      fieldops: { owner: 'Maya Chen', envs: 3, sizeBytes: 4.2 * GB, archived: false },
      purchase_approvals: { owner: 'Jordan Lee', envs: 1, sizeBytes: 88 * MB, archived: false },
      client_onboarding: { owner: 'Priya Nair', envs: 3, sizeBytes: 1.1 * GB, archived: false },
    },
    ai: {
      providers: [
        {
          id: 'claude',
          name: 'Anthropic Claude',
          kind: 'Cloud API',
          enabled: true,
          keySet: true,
          needsKey: true,
          models: ['Claude Opus', 'Claude Sonnet', 'Claude Haiku'],
          enabledModels: ['Claude Opus', 'Claude Sonnet', 'Claude Haiku'],
          defaultModel: 'Claude Sonnet',
        },
        {
          id: 'gpt',
          name: 'OpenAI GPT',
          kind: 'Cloud API',
          enabled: true,
          keySet: true,
          needsKey: true,
          models: ['GPT-4.1', 'GPT-4.1 mini', 'o4-mini'],
          enabledModels: ['GPT-4.1', 'GPT-4.1 mini'],
          defaultModel: 'GPT-4.1',
        },
        {
          id: 'local',
          name: 'Local models',
          kind: 'On this server · Ollama',
          enabled: false,
          keySet: false,
          needsKey: false,
          models: ['Llama 3.1 70B', 'Qwen 2.5 32B', 'DeepSeek-R1 32B'],
          enabledModels: ['Llama 3.1 70B'],
          defaultModel: 'Llama 3.1 70B',
        },
      ],
      defaultProvider: 'claude',
      featureModels: {
        chat: 'Claude Sonnet',
        plans: 'Claude Opus',
        code: 'Claude Sonnet',
        translate: 'GPT-4.1 mini',
        summaries: 'Claude Haiku',
      },
      budget: 2000,
      warnAt: 80,
      spent: 1712,
      usage: usageDays(),
      byModel: [
        { model: 'Claude Opus', provider: 'claude', cost: 618, input: 9.8, output: 1.1 },
        { model: 'Claude Sonnet', provider: 'claude', cost: 566, input: 31.4, output: 4.2 },
        { model: 'Claude Haiku', provider: 'claude', cost: 74, input: 18.6, output: 2.3 },
        { model: 'GPT-4.1', provider: 'gpt', cost: 312, input: 12.9, output: 1.6 },
        { model: 'GPT-4.1 mini', provider: 'gpt', cost: 96, input: 22.7, output: 2.9 },
        { model: 'Llama 3.1 70B', provider: 'local', cost: 46, input: 6.2, output: 0.8 },
      ],
      byProject: [
        { project: 'FieldOps Service Desk', input: 38.2, output: 4.6 },
        { project: 'Client Onboarding Portal', input: 29.5, output: 3.7 },
        { project: 'Purchase Approvals', input: 21.8, output: 2.9 },
      ],
      policy: { noProduction: true, noSecrets: true, localOnly: false },
      mcp: [
        { id: 'mcp_docs', name: 'Company docs', url: 'https://mcp.acme-facilities.com/docs', enabled: true },
        { id: 'mcp_jira', name: 'Jira', url: 'https://mcp.atlassian.com/acme', enabled: true },
      ],
    },
    aiKeys: { claude: 'demo', gpt: 'demo' },
    databases: {
      host: 'app-01 · Ubuntu 22.04 LTS',
      engines: [
        {
          id: 'pg',
          name: 'PostgreSQL',
          version: '16.4',
          port: 5432,
          running: true,
          diskUsedGb: 38,
          diskTotalGb: 120,
          connections: 84,
          maxConnections: 300,
        },
        {
          id: 'mysql',
          name: 'MySQL',
          version: '8.0.39',
          port: 3306,
          running: true,
          diskUsedGb: 6,
          diskTotalGb: 40,
          connections: 12,
          maxConnections: 150,
        },
        {
          id: 'redis',
          name: 'Redis',
          version: '7.2',
          port: 6379,
          running: true,
          diskUsedGb: 1.2,
          diskTotalGb: 4,
          connections: 41,
          maxConnections: 1000,
        },
      ],
      databases: [
        {
          name: 'fieldops_dev',
          engine: 'pg',
          project: 'FieldOps Service Desk',
          env: 'development',
          sizeBytes: 420 * MB,
          backup: 'daily',
        },
        {
          name: 'fieldops_stg',
          engine: 'pg',
          project: 'FieldOps Service Desk',
          env: 'staging',
          sizeBytes: 1.1 * GB,
          backup: 'daily',
        },
        {
          name: 'fieldops_prod',
          engine: 'pg',
          project: 'FieldOps Service Desk',
          env: 'production',
          sizeBytes: 2.6 * GB,
          backup: '6h',
        },
        {
          name: 'onboarding_prod',
          engine: 'pg',
          project: 'Client Onboarding Portal',
          env: 'production',
          sizeBytes: 740 * MB,
          backup: 'daily',
        },
        {
          name: 'approvals_dev',
          engine: 'mysql',
          project: 'Purchase Approvals',
          env: 'development',
          sizeBytes: 210 * MB,
          backup: 'weekly',
        },
        {
          name: 'sessions',
          engine: 'redis',
          project: 'All projects',
          env: 'shared',
          sizeBytes: 1.2 * GB,
          backup: 'off',
        },
      ],
    },
    sandboxes: [
      {
        id: 'frontend',
        name: 'Frontend sandbox',
        kind: 'Vue 3 · Vite · Platon UI Kit · TypeScript',
        running: true,
        source: 'git',
        git: {
          url: 'https://git.acme-facilities.com/platform/platon-frontend-sandbox.git',
          refType: 'tag',
          ref: 'v3.4.2',
          path: '/',
          auth: 'token',
          tokenSet: true,
          publicKey: 'ssh-ed25519 AAAAC3Nza…k2Qe studio@acme',
          autoSync: true,
        },
        template: { channel: 'stable', version: '3.4.2' },
        image: {
          ref: 'registry.acme-facilities.com/platon/frontend-sandbox:3.4.2',
          pullSecret: 'acme-registry',
          pinDigest: true,
        },
        archive: { file: '', sizeBytes: 0 },
        version: '3.4.2',
        commit: 'a1f93c2',
        appliedAt: ago(DAY * 11),
        appliedBy: 'Diego Ruiz',
        latest: {
          version: '3.5.0',
          commit: 'c07be41',
          note: 'Tag v3.5.0 pushed Oct 7 · Vue 3.5.13, Vite 6, faster hot reload',
          diff: [
            { name: 'Vue', from: '3.5.12', to: '3.5.13' },
            { name: 'Vite', from: '5.4.8', to: '6.0.1' },
            { name: 'Platon UI Kit', from: '2.8.1', to: '2.9.0' },
          ],
        },
        stack: [
          { name: 'Node.js', version: '20.17.0' },
          { name: 'Vue', version: '3.5.12' },
          { name: 'Vite', version: '5.4.8' },
          { name: 'Platon UI Kit', version: '2.8.1' },
          { name: 'TypeScript', version: '5.6.2' },
          { name: 'pnpm', version: '9.12.0' },
        ],
        templateVersions: ['3.5.0', '3.4.2', '3.3.0'],
        run: {
          pm: 'pnpm',
          install: 'pnpm install --frozen-lockfile',
          dev: 'pnpm dev --host 0.0.0.0',
          build: 'pnpm build',
          port: 5173,
          health: '/',
        },
        resources: { cpu: '1 vCPU', memory: '2 GB', disk: '5 GB', idle: '30 min', maxRunning: 20 },
        network: {
          mode: 'allowlist',
          allow: ['registry.npmjs.org', 'cdn.acme-facilities.com', 'api.fieldops.app'],
          registry: 'https://npm.acme-facilities.com',
          proxy: '',
        },
        env: [
          { id: 'e1', key: 'VITE_API_BASE', secret: false, value: 'https://api.fieldops.app' },
          { id: 'e2', key: 'VITE_MAPS_KEY', secret: true, set: true },
        ],
        ai: {
          folders: ['src/pages', 'src/components', 'src/composables', 'src/assets', 'src/router'],
          writable: ['src/pages', 'src/components'],
          review: true,
        },
        manifest: JSON.stringify(
          {
            kind: 'frontend',
            run: { install: 'pnpm install', dev: 'pnpm dev', build: 'pnpm build', port: 5173 },
            aiWritable: ['src/pages', 'src/components'],
            components: 'src/components',
            pages: 'src/pages',
          },
          null,
          2,
        ),
        projects: [],
        history: [
          { version: '3.4.2', at: ago(DAY * 11), by: 'Diego Ruiz', note: 'Platon UI Kit 2.8, chart fixes' },
          { version: '3.3.0', at: ago(DAY * 56), by: 'Maya Chen', note: 'Vue 3.5, Vite 5.4' },
          { version: '3.2.1', at: ago(DAY * 101), by: 'Diego Ruiz', note: 'Security patch for dev server' },
        ],
      },
      {
        id: 'backend',
        name: 'Backend sandbox',
        kind: 'Node.js · NestJS · Platon Runtime',
        running: true,
        source: 'template',
        git: {
          url: '',
          refType: 'branch',
          ref: 'main',
          path: '/',
          auth: 'ssh',
          tokenSet: false,
          publicKey: 'ssh-ed25519 AAAAC3Nza…9fLm studio@acme',
          autoSync: false,
        },
        template: { channel: 'lts', version: '2.9.0' },
        image: {
          ref: 'registry.acme-facilities.com/platon/backend-sandbox:2.9.0',
          pullSecret: 'acme-registry',
          pinDigest: true,
        },
        archive: { file: '', sizeBytes: 0 },
        version: '2.9.0',
        commit: '5d2e8aa',
        appliedAt: ago(DAY * 7),
        appliedBy: 'Maya Chen',
        latest: null,
        stack: [
          { name: 'Node.js', version: '20.17.0' },
          { name: 'NestJS', version: '10.4.5' },
          { name: 'Platon Runtime SDK', version: '4.1.0' },
          { name: 'Prisma', version: '5.20.0' },
          { name: 'TypeScript', version: '5.6.2' },
        ],
        templateVersions: ['2.9.0', '2.8.3', '2.7.1'],
        run: {
          pm: 'npm',
          install: 'npm ci',
          dev: 'npm run start:dev',
          build: 'npm run build',
          port: 3000,
          health: '/health',
        },
        resources: { cpu: '2 vCPU', memory: '4 GB', disk: '10 GB', idle: '1 hour', maxRunning: 12 },
        network: {
          mode: 'allowlist',
          allow: ['registry.npmjs.org', 'api.twilio.com', 'smtp.acme-facilities.com'],
          registry: 'https://npm.acme-facilities.com',
          proxy: 'http://proxy.acme-facilities.com:3128',
        },
        env: [
          { id: 'e1', key: 'DATABASE_URL', secret: true, set: true },
          { id: 'e2', key: 'TWILIO_TOKEN', secret: true, set: true },
          { id: 'e3', key: 'LOG_LEVEL', secret: false, value: 'info' },
        ],
        ai: {
          folders: ['src/functions', 'src/apis', 'src/jobs', 'src/queues', 'src/lib'],
          writable: ['src/functions', 'src/apis', 'src/jobs'],
          review: true,
        },
        manifest: JSON.stringify(
          {
            kind: 'backend',
            run: { install: 'npm ci', dev: 'npm run start:dev', build: 'npm run build', port: 3000 },
            health: '/health',
            aiWritable: ['src/functions', 'src/apis', 'src/jobs'],
          },
          null,
          2,
        ),
        projects: [],
        history: [
          {
            version: '2.9.0',
            at: ago(DAY * 7),
            by: 'Maya Chen',
            note: 'Platon Runtime SDK 4.1, queue retries',
          },
          { version: '2.8.3', at: ago(DAY * 34), by: 'Diego Ruiz', note: 'Prisma 5.20' },
        ],
      },
    ],
    sandboxSecrets: { frontend: { e2: 'demo', __git: 'demo' }, backend: { e1: 'demo', e2: 'demo' } },
    sandboxProjectVersions: { frontend: { fieldops: '3.4.2' }, backend: {} },
    modules: [
      {
        id: 'auth',
        label: 'Sign-in methods',
        description: 'Which sign-in methods projects may offer to their app users.',
        keepOne: true,
        items: [
          {
            id: 'password',
            label: 'Email & password',
            description: 'Sign in with email and password',
            icon: 'mail',
            enabled: true,
            impact: 'All projects',
          },
          {
            id: 'magic',
            label: 'Magic link',
            description: 'One-time sign-in link by email',
            icon: 'wand-sparkles',
            enabled: false,
          },
          {
            id: 'google',
            label: 'Google sign-in',
            description: 'Sign in with a Google account',
            icon: 'chrome',
            enabled: true,
            impact: '2 projects · 312 app users',
          },
          {
            id: 'eimzo',
            label: 'E-IMZO',
            description: 'Digital signature key (Uzbekistan)',
            icon: 'pen-tool',
            enabled: true,
            impact: '1 project · 96 app users',
          },
          {
            id: 'oneid',
            label: 'OneID',
            description: 'Uzbekistan state single sign-on (id.egov.uz)',
            icon: 'badge-check',
            enabled: true,
            impact: '1 project · 540 app users',
          },
          {
            id: 'rsid',
            label: 'RS ID',
            description: 'Remote identity verification',
            icon: 'fingerprint',
            enabled: false,
          },
          {
            id: 'keycloak',
            label: 'Keycloak',
            description: 'Self-hosted identity server (OIDC)',
            icon: 'key-square',
            enabled: true,
          },
          {
            id: 'ldap',
            label: 'LDAP / Active Directory',
            description: 'Company directory accounts',
            icon: 'network',
            enabled: true,
            impact: '1 project',
          },
          {
            id: 'twofa',
            label: 'Two-factor authentication',
            description: 'Authenticator app codes',
            icon: 'smartphone',
            enabled: true,
          },
        ],
      },
      {
        id: 'brokers',
        label: 'Message brokers',
        description: 'Brokers projects can use for queues and events.',
        keepOne: true,
        items: [
          {
            id: 'rabbit',
            label: 'RabbitMQ',
            description: 'Exchanges, routing keys and queues · amqp://mq.acme-facilities.internal:5672',
            icon: 'rabbit',
            enabled: true,
            impact: '3 queues in FieldOps',
          },
          {
            id: 'kafka',
            label: 'Apache Kafka',
            description: 'Topics, partitions and consumer groups',
            icon: 'layers',
            enabled: true,
          },
          {
            id: 'nats',
            label: 'NATS / JetStream',
            description: 'Subjects and streams',
            icon: 'zap',
            enabled: false,
          },
        ],
      },
      {
        id: 'features',
        label: 'Studio features',
        description: 'Layers and tools available in every project.',
        keepOne: false,
        items: [
          {
            id: 'queues',
            label: 'Message queues',
            description: 'Queues, MQ produce and MQ consume layers',
            icon: 'inbox',
            enabled: true,
            impact: '3 queues in FieldOps',
          },
          {
            id: 'crons',
            label: 'Crons',
            description: 'Scheduled jobs',
            icon: 'clock',
            enabled: true,
            impact: '3 crons in FieldOps',
          },
          {
            id: 'publicApi',
            label: 'Public APIs',
            description: 'Expose APIs outside the app',
            icon: 'globe',
            enabled: true,
          },
          {
            id: 'gitExport',
            label: 'Git export',
            description: 'Connect projects to Git repositories',
            icon: 'git-branch',
            enabled: true,
          },
          {
            id: 'localStorage',
            label: 'Local storage',
            description: 'Server folders in Storage',
            icon: 'server',
            enabled: true,
          },
          {
            id: 'translations',
            label: 'Translations',
            description: 'Multi-language apps',
            icon: 'languages',
            enabled: true,
          },
          {
            id: 'aiAssist',
            label: 'Studio AI',
            description: 'AI panel in every layer',
            icon: 'sparkles',
            enabled: true,
          },
        ],
      },
    ],
    audit: [
      {
        id: 'a1',
        at: ago(40),
        who: 'Maya Chen',
        text: 'Released FieldOps v1.4 to Production',
        area: 'Projects',
      },
      { id: 'a2', at: ago(180), who: 'Diego Ruiz', text: 'Changed Priya Nair role to Editor', area: 'Users' },
      {
        id: 'a3',
        at: ago(320),
        who: 'System',
        text: 'AI budget reached 80% · warning sent to admins',
        area: 'AI',
      },
      {
        id: 'a4',
        at: ago(DAY + 200),
        who: 'Maya Chen',
        text: 'Turned off GitHub sign-in for all projects',
        area: 'Modules',
      },
      {
        id: 'a5',
        at: ago(DAY * 3),
        who: 'Diego Ruiz',
        text: 'Created database onboarding_prod',
        area: 'Databases',
      },
      {
        id: 'a6',
        at: ago(DAY * 7),
        who: 'Maya Chen',
        text: 'Updated backend sandbox to v2.9.0',
        area: 'Sandboxes',
      },
      {
        id: 'a7',
        at: ago(DAY * 9),
        who: 'Maya Chen',
        text: 'Changed Studio support contact',
        area: 'Studio',
      },
      {
        id: 'a8',
        at: ago(DAY * 12),
        who: 'Diego Ruiz',
        text: 'Allowed “Run SQL in Development” for Editor',
        area: 'Roles',
      },
    ],
  }
}
