/**
 * Static catalogs shared by Studio, the renderer and validators.
 * Icons are lucide names (kebab-case); tones map to design-token tones in the UI kit.
 */
import type { BlockType, DbEngine, StepType, TableFieldType } from './generated/app-definition'
import type { ChangeArea } from './generated/change'

export type CatalogTone = 'neutral' | 'primary' | 'ok' | 'warn' | 'danger' | 'purple' | 'teal' | 'info' | 'ai'

export interface BlockMeta {
  label: string
  icon: string
  hint: string
  group: 'layout' | 'data' | 'form' | 'charts' | 'navigation' | 'custom'
  /** Comes from the Platon UI Kit (shown with a "UI Kit" tag in the palette). */
  kit?: boolean
  events: string[]
  /** Variants offered in the inspector. */
  variants?: [string, string][]
  tags?: string
}

export const BLOCK_GROUPS: { id: BlockMeta['group']; label: string }[] = [
  { id: 'layout', label: 'Text & layout' },
  { id: 'data', label: 'Data' },
  { id: 'form', label: 'Form controls' },
  { id: 'charts', label: 'Charts & calendar' },
  { id: 'navigation', label: 'Navigation & feedback' },
]

export const BLOCKS: Record<BlockType, BlockMeta> = {
  header: {
    label: 'Page header',
    icon: 'heading',
    hint: 'Title, subtitle and a main button',
    group: 'layout',
    events: ['buttonClick'],
    tags: 'title heading hero intro',
  },
  text: {
    label: 'Text',
    icon: 'type',
    hint: 'Instructions or context',
    group: 'layout',
    events: [],
    tags: 'paragraph copy description note',
  },
  image: {
    label: 'Image',
    icon: 'image',
    hint: 'Photo or illustration',
    group: 'layout',
    events: ['click'],
    tags: 'photo picture media logo',
  },
  button: {
    label: 'Button',
    icon: 'mouse-pointer-click',
    hint: 'Start an action',
    group: 'layout',
    events: ['click'],
    tags: 'action cta link',
  },
  divider: { label: 'Divider', icon: 'minus', hint: 'Separate sections', group: 'layout', events: [] },
  stats: {
    label: 'Numbers',
    icon: 'chart-column',
    hint: 'Counts from your data',
    group: 'data',
    events: ['click'],
    tags: 'kpi metrics counters',
  },
  table: {
    label: 'Table',
    icon: 'table',
    hint: 'List records from a table',
    group: 'data',
    events: ['rowClick', 'select', 'load'],
    tags: 'grid list records rows',
  },
  form: {
    label: 'Form',
    icon: 'square-pen',
    hint: 'Create or edit a record',
    group: 'data',
    events: ['submit', 'change'],
    tags: 'edit create fields',
  },
  list: { label: 'List', icon: 'list', hint: 'Cards for each record', group: 'data', events: ['rowClick'] },
  detail: {
    label: 'Record details',
    icon: 'file-text',
    hint: 'Read-only fields of one record',
    group: 'data',
    events: [],
  },
  input: {
    label: 'Text input',
    icon: 'text-cursor-input',
    hint: 'Single-line text field',
    group: 'form',
    kit: true,
    events: ['change'],
    variants: [
      ['text', 'Text'],
      ['email', 'Email'],
      ['search', 'Search'],
      ['password', 'Password'],
    ],
  },
  select: {
    label: 'Select',
    icon: 'square-chevron-down',
    hint: 'Pick one from a list',
    group: 'form',
    kit: true,
    events: ['change'],
  },
  checkbox: {
    label: 'Checkbox',
    icon: 'square-check',
    hint: 'Tick one or more options',
    group: 'form',
    kit: true,
    events: ['change'],
  },
  radio: {
    label: 'Radio group',
    icon: 'circle-dot',
    hint: 'Choose exactly one option',
    group: 'form',
    kit: true,
    events: ['change'],
  },
  switch: {
    label: 'Switch',
    icon: 'toggle-right',
    hint: 'Turn a setting on or off',
    group: 'form',
    kit: true,
    events: ['change'],
  },
  date: {
    label: 'Date picker',
    icon: 'calendar-days',
    hint: 'Pick a date from a calendar',
    group: 'form',
    kit: true,
    events: ['change'],
  },
  textarea: {
    label: 'Text area',
    icon: 'text-align-start',
    hint: 'Multi-line notes',
    group: 'form',
    kit: true,
    events: ['change'],
  },
  upload: {
    label: 'File upload',
    icon: 'upload',
    hint: 'Attach files or photos',
    group: 'form',
    kit: true,
    events: ['change'],
  },
  bar: {
    label: 'Bar chart',
    icon: 'chart-column-big',
    hint: 'Compare values by category',
    group: 'charts',
    kit: true,
    events: ['click'],
  },
  line: {
    label: 'Line chart',
    icon: 'chart-line',
    hint: 'Trend over time',
    group: 'charts',
    kit: true,
    events: ['click'],
  },
  donut: {
    label: 'Donut chart',
    icon: 'chart-pie',
    hint: 'Share of a whole',
    group: 'charts',
    kit: true,
    events: ['click'],
  },
  calendar: {
    label: 'Calendar',
    icon: 'calendar',
    hint: 'Month view with events',
    group: 'charts',
    kit: true,
    events: ['select'],
  },
  progress: {
    label: 'Progress',
    icon: 'gauge',
    hint: 'Completion per item',
    group: 'charts',
    kit: true,
    events: [],
  },
  timeline: {
    label: 'Timeline',
    icon: 'history',
    hint: 'Activity in order',
    group: 'charts',
    kit: true,
    events: [],
  },
  tabs: {
    label: 'Tabs',
    icon: 'panels-top-left',
    hint: 'Switch between panels',
    group: 'navigation',
    kit: true,
    events: ['change'],
  },
  steps: {
    label: 'Steps',
    icon: 'list-ordered',
    hint: 'Multi-step progress',
    group: 'navigation',
    kit: true,
    events: ['change'],
  },
  alert: {
    label: 'Alert',
    icon: 'triangle-alert',
    hint: 'Highlight a message',
    group: 'navigation',
    kit: true,
    events: [],
    variants: [
      ['info', 'Info'],
      ['success', 'Success'],
      ['warning', 'Warning'],
      ['error', 'Error'],
    ],
  },
  pagination: {
    label: 'Pagination',
    icon: 'ellipsis',
    hint: 'Page through long lists',
    group: 'navigation',
    kit: true,
    events: ['change'],
    variants: [
      ['full', 'Full · range and page size'],
      ['simple', 'Simple · previous / next'],
    ],
  },
  custom: {
    label: 'Custom component',
    icon: 'puzzle',
    hint: 'Built in the component constructor',
    group: 'custom',
    events: [],
  },
}

/** Block properties exposed to page code as ctx.blocks.<ref>.* */
export const BLOCK_API_COMMON: [string, string, string][] = [
  ['visible', 'boolean', 'Show or hide the block'],
  ['disabled', 'boolean', 'Visible, but people can’t use it'],
]
export const BLOCK_API: Partial<Record<BlockType, [string, string, string][]>> = {
  header: [
    ['title', 'string', 'Heading text'],
    ['subtitle', 'string', 'Text under the heading'],
    ['buttonLabel', 'string', 'Main button text'],
    ['buttonDisabled', 'boolean', 'Disable only the main button'],
  ],
  table: [
    ['rows', 'Row[]', 'Rows currently loaded'],
    ['selected', 'Row[]', 'Selected rows'],
    ['load(params)', 'Promise<void>', 'Load rows with filters'],
    ['reload()', 'Promise<void>', 'Load again with the last filters'],
  ],
  form: [
    ['values', 'Record<string, unknown>', 'Current field values'],
    ['valid', 'boolean', 'All required fields are filled'],
    ['field(name)', 'Field', 'One field'],
    ['setValue(name, value)', 'void', 'Change a field'],
    ['reset()', 'void', 'Back to initial values'],
    ['submit()', 'Promise<void>', 'Validate and save'],
  ],
  stats: [['refresh()', 'Promise<void>', 'Recount']],
  text: [['text', 'string', 'Text content']],
  button: [['label', 'string', 'Button text']],
  image: [['src', 'string', 'Image URL']],
}

/** Event → argument name passed to handlers. */
export const EVENT_ARG: Record<string, string> = {
  click: 'event',
  buttonClick: 'event',
  rowClick: 'row',
  select: 'rows',
  load: 'rows',
  submit: 'values',
  change: 'value',
}

export interface StepMeta {
  label: string
  icon: string
  tone: CatalogTone
  group: 'Logic' | 'Data' | 'Integrations' | 'Functions'
  fields: {
    key: string
    label: string
    input: 'mono' | 'text' | 'area' | 'select'
    options?: 'tables' | 'queues' | 'functions' | string[]
  }[]
}

export const STEPS: Record<StepType, StepMeta> = {
  if: {
    label: 'If',
    icon: 'git-branch',
    tone: 'warn',
    group: 'Logic',
    fields: [{ key: 'condition', label: 'Condition', input: 'mono' }],
  },
  switch: {
    label: 'Switch',
    icon: 'split',
    tone: 'warn',
    group: 'Logic',
    fields: [
      { key: 'value', label: 'Value to check', input: 'mono' },
      { key: 'cases', label: 'Cases (comma separated)', input: 'text' },
    ],
  },
  for: {
    label: 'For each',
    icon: 'repeat',
    tone: 'warn',
    group: 'Logic',
    fields: [
      { key: 'list', label: 'List', input: 'mono' },
      { key: 'as', label: 'Item name', input: 'mono' },
    ],
  },
  set: {
    label: 'Set variable',
    icon: 'variable',
    tone: 'neutral',
    group: 'Logic',
    fields: [
      { key: 'name', label: 'Variable', input: 'mono' },
      { key: 'value', label: 'Value', input: 'mono' },
    ],
  },
  return: { label: 'Return', icon: 'corner-down-left', tone: 'neutral', group: 'Logic', fields: [] },
  select: {
    label: 'Select query',
    icon: 'table-2',
    tone: 'primary',
    group: 'Data',
    fields: [
      { key: 'table', label: 'Table', input: 'select', options: 'tables' },
      { key: 'where', label: 'Where', input: 'mono' },
      { key: 'limit', label: 'Limit', input: 'text' },
      { key: 'into', label: 'Save result as', input: 'mono' },
    ],
  },
  execute: {
    label: 'Execute query',
    icon: 'database-zap',
    tone: 'primary',
    group: 'Data',
    fields: [{ key: 'sql', label: 'SQL', input: 'area' }],
  },
  http: {
    label: 'HTTP request',
    icon: 'globe',
    tone: 'teal',
    group: 'Integrations',
    fields: [
      { key: 'method', label: 'Method', input: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'url', label: 'URL', input: 'mono' },
      { key: 'body', label: 'Body', input: 'area' },
      { key: 'into', label: 'Save response as', input: 'mono' },
    ],
  },
  produce: {
    label: 'MQ produce',
    icon: 'send',
    tone: 'purple',
    group: 'Integrations',
    fields: [
      { key: 'queue', label: 'Queue', input: 'select', options: 'queues' },
      { key: 'message', label: 'Message', input: 'area' },
    ],
  },
  consume: {
    label: 'MQ consume',
    icon: 'inbox',
    tone: 'purple',
    group: 'Integrations',
    fields: [
      { key: 'queue', label: 'Queue', input: 'select', options: 'queues' },
      { key: 'into', label: 'Save message as', input: 'mono' },
    ],
  },
  call: {
    label: 'Function',
    icon: 'braces',
    tone: 'primary',
    group: 'Functions',
    fields: [
      { key: 'fn', label: 'Function', input: 'select', options: 'functions' },
      { key: 'args', label: 'Arguments', input: 'mono' },
      { key: 'into', label: 'Save result as', input: 'mono' },
    ],
  },
}

export const LOGIC_KINDS = {
  functions: {
    label: 'Functions',
    icon: 'braces',
    tone: 'primary',
    hint: 'Reusable server code. Call it from APIs, crons, queues or interface actions.',
    create: 'New function',
  },
  apis: {
    label: 'APIs',
    icon: 'plug',
    tone: 'teal',
    hint: 'HTTP endpoints your app and partners call. Each one runs a function or reads data.',
    create: 'New API',
  },
  crons: {
    label: 'Crons',
    icon: 'clock',
    tone: 'warn',
    hint: 'Jobs that run on a schedule in every environment.',
    create: 'New cron',
  },
  queues: {
    label: 'Message Queues',
    icon: 'inbox',
    tone: 'purple',
    hint: 'Hand work off to run in the background. Messages wait here until a consumer picks them up.',
    create: 'New queue',
  },
} as const satisfies Record<
  string,
  { label: string; icon: string; tone: CatalogTone; hint: string; create: string }
>

export type LogicKind = keyof typeof LOGIC_KINDS

export const VALUE_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'date',
  'datetime',
  'enum',
  'object',
  'array<string>',
  'array<number>',
  'array<object>',
  'file',
  'any',
] as const

export const ENGINES: Record<
  DbEngine,
  { label: string; icon: string; tone: CatalogTone; port: number; kind: string; unit: string; sql: boolean }
> = {
  postgres: {
    label: 'PostgreSQL',
    icon: 'database',
    tone: 'primary',
    port: 5432,
    kind: 'Tables',
    unit: 'table',
    sql: true,
  },
  mysql: {
    label: 'MySQL',
    icon: 'database',
    tone: 'info',
    port: 3306,
    kind: 'Tables',
    unit: 'table',
    sql: true,
  },
  mssql: {
    label: 'SQL Server',
    icon: 'server',
    tone: 'neutral',
    port: 1433,
    kind: 'Tables',
    unit: 'table',
    sql: true,
  },
  mongo: {
    label: 'MongoDB',
    icon: 'leaf',
    tone: 'ok',
    port: 27017,
    kind: 'Collections',
    unit: 'collection',
    sql: false,
  },
  redis: {
    label: 'Redis',
    icon: 'zap',
    tone: 'danger',
    port: 6379,
    kind: 'Key sets',
    unit: 'key set',
    sql: false,
  },
}

export const FIELD_TYPES: Record<TableFieldType, { label: string; icon: string; sql: string }> = {
  auto_number: { label: 'Auto number', icon: 'hash', sql: 'BIGSERIAL' },
  text: { label: 'Text', icon: 'type', sql: 'VARCHAR(255)' },
  long_text: { label: 'Long text', icon: 'text-align-start', sql: 'TEXT' },
  number: { label: 'Number', icon: 'hash', sql: 'NUMERIC(12,2)' },
  currency: { label: 'Currency', icon: 'banknote', sql: 'NUMERIC(12,2)' },
  date: { label: 'Date', icon: 'calendar', sql: 'DATE' },
  datetime: { label: 'Date & time', icon: 'calendar-clock', sql: 'TIMESTAMPTZ' },
  checkbox: { label: 'Checkbox', icon: 'square-check', sql: 'BOOLEAN' },
  single_select: { label: 'Single select', icon: 'circle-chevron-down', sql: 'VARCHAR(64)' },
  multi_select: { label: 'Multi select', icon: 'list', sql: 'TEXT[]' },
  workflow_state: { label: 'Workflow state', icon: 'workflow', sql: 'VARCHAR(64)' },
  user_account: { label: 'User account', icon: 'user', sql: 'UUID' },
  file: { label: 'File attachment', icon: 'paperclip', sql: 'JSONB' },
  link: { label: 'Link to table', icon: 'link', sql: 'BIGINT' },
  json: { label: 'JSON', icon: 'braces', sql: 'JSONB' },
}

export const CHANGE_AREAS: Record<ChangeArea, { icon: string; tone: CatalogTone }> = {
  Pages: { icon: 'layout-dashboard', tone: 'primary' },
  Logic: { icon: 'braces', tone: 'primary' },
  Database: { icon: 'database', tone: 'teal' },
  Storage: { icon: 'hard-drive', tone: 'ok' },
  Settings: { icon: 'settings', tone: 'neutral' },
  Permissions: { icon: 'lock', tone: 'purple' },
  Workflow: { icon: 'workflow', tone: 'info' },
  Components: { icon: 'puzzle', tone: 'ai' },
}

export const PAGE_ICONS = [
  'layout-dashboard',
  'clipboard-list',
  'calendar-days',
  'building-2',
  'hard-hat',
  'users',
  'package',
  'file-text',
  'map-pin',
  'inbox',
  'wrench',
  'truck',
  'receipt',
  'chart-line',
  'settings',
  'bell',
  'shield-check',
  'list-checks',
  'timer',
  'boxes',
  'credit-card',
  'file-spreadsheet',
  'gauge',
  'plug',
  'refresh-cw',
  'square-plus',
  'user-round',
  'building',
  'map-pinned',
  'message-square-text',
  'file-cog',
  'calendar-sync',
  'list-todo',
  'file-check',
  'users-round',
  'house',
  'star',
  'folder',
]

export interface LifecycleHookMeta {
  name: string
  vue: string
  hint: string
  /** Handler may return false to stop navigation. */
  canCancel?: boolean
}

export const LIFECYCLE_PHASES: { label: string; sub: string; hooks: LifecycleHookMeta[] }[] = [
  {
    label: 'Opening',
    sub: 'once per visit',
    hooks: [
      { name: 'onPageInit', vue: 'created', hint: 'Before data loads. Read the URL, set defaults.' },
      { name: 'onBeforeRender', vue: 'beforeMount', hint: 'Data is ready, blocks are not drawn yet.' },
      {
        name: 'onPageReady',
        vue: 'mounted',
        hint: 'Page is on screen. Load data, focus a field, start timers.',
      },
    ],
  },
  {
    label: 'While open',
    sub: 'can run many times',
    hooks: [
      { name: 'onBeforeRefresh', vue: 'beforeUpdate', hint: 'Before blocks redraw after data changes.' },
      { name: 'onAfterRefresh', vue: 'updated', hint: 'After blocks redraw.' },
      { name: 'onPageResume', vue: 'activated', hint: 'User comes back to a cached page or tab.' },
      { name: 'onPagePause', vue: 'deactivated', hint: 'User switches away. The page stays cached.' },
    ],
  },
  {
    label: 'Closing',
    sub: 'once per visit',
    hooks: [
      {
        name: 'onBeforeLeave',
        vue: 'beforeUnmount',
        hint: 'Before the user navigates away. Can stop it.',
        canCancel: true,
      },
      { name: 'onPageLeave', vue: 'unmounted', hint: 'Page has closed. Stop timers, clean up.' },
    ],
  },
  {
    label: 'Errors',
    sub: '',
    hooks: [{ name: 'onPageError', vue: 'errorCaptured', hint: 'A block or handler on this page throws.' }],
  },
]

/** What page code can reach on `ctx` (autocomplete + docs). */
export const PAGE_CTX: [string, string, string][] = [
  ['blocks', 'object', 'Blocks on this page'],
  ['state', 'object', 'Page state, kept while the page is open'],
  ['call', 'method', "Run a Logic function: ctx.call('name', { … })"],
  ['navigate', 'method', "Go to a page: ctx.navigate('/orders')"],
  ['toast', 'method', 'Show a short message'],
  ['confirm', 'method', 'Ask yes / no. Returns true or false'],
  ['route', 'object', 'URL params and query'],
  ['user', 'object', 'Signed-in user and role'],
  ['log', 'method', 'Write to the console'],
]
