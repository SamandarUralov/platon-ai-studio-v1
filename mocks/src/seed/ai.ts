/**
 * Studio AI mock: seeded chat history and a scripted assistant.
 *
 * The assistant recognises a few intents and answers with REAL id-addressed JSON Patch ops computed
 * against the project's current definition, so applying a plan goes through the same path as a
 * human edit. Everything here is pure (no db access) so tests can run it against the seed.
 */
import {
  getAt,
  newId,
  pascal,
  snake,
  uniqueName,
  type AiChip,
  type AiComponentGen,
  type AiConversation,
  type AiDiff,
  type AiDiffLine,
  type AiMessage,
  type AiNaming,
  type AiPlan,
  type AiPlanItem,
  type AppDefinition,
  type Block,
  type ChangeInput,
  type ComponentProp,
  type CustomComponent,
  type Page,
  type SendAiMessageRequest,
} from '@platon/definition'

// ── intents ──────────────────────────────────────────────────────────────────────────

export type AiIntent =
  | 'priority'
  | 'translate'
  | 'page'
  | 'access'
  | 'code'
  | 'component'
  | 'explain'
  | 'ask_table'
  | 'ask_workflow'
  | 'chat'

const SKILL_INTENT: Record<string, AiIntent> = {
  field: 'priority',
  translate: 'translate',
  access: 'access',
  explain: 'explain',
  table: 'ask_table',
  workflow: 'ask_workflow',
  'create-component': 'component',
  'create-page': 'component',
}

export function detectIntent(req: Pick<SendAiMessageRequest, 'text' | 'chips' | 'context'>): AiIntent {
  const skill = req.chips.find((c) => c.kind === 'skill')?.skill
  if (skill && SKILL_INTENT[skill]) return SKILL_INTENT[skill]
  const t = req.text.toLowerCase()
  if (/\bpriorit/.test(t)) return 'priority'
  if (/translat|language|uzbek|o[’']?zbek|russian|spanish|español/.test(t)) return 'translate'
  if (/\bcomponents?\b|\.vue\b/.test(t)) return 'component'
  if (req.context?.kind === 'code' || /refresh|reload every|poll|auto-?update/.test(t)) return 'code'
  if (/technicians? (should )?only|assigned to them|own (jobs|work)|access|visib/.test(t)) return 'access'
  if (/\bpage\b|\bscreen\b/.test(t) && /add|create|new|make|build/.test(t)) return 'page'
  if (/explain|what does|summar|describe/.test(t)) return 'explain'
  return 'chat'
}

// ── reply shape ──────────────────────────────────────────────────────────────────────

export interface ScriptedReply {
  note?: string
  text: string
  plan?: AiPlan
  diff?: AiDiff
  naming?: AiNaming
  component?: AiComponentGen
}

function plan(title: string, after: string, items: Omit<AiPlanItem, 'id' | 'status'>[]): AiPlan {
  const id = newId('plan')
  return {
    id,
    title,
    after,
    status: 'pending',
    items: items.map((it, i) => ({ ...it, id: `${id}_${i + 1}`, status: 'pending' })),
  }
}

const pages = (def: AppDefinition) => def.interface.pages
const tableOf = (def: AppDefinition, id: string) => def.data.tables.find((t) => t.id === id)
const sourceOf = (b: Block) => (b.props as { source?: unknown }).source
const columnsOf = (b: Block) => {
  const c = (b.props as { columns?: unknown }).columns
  return Array.isArray(c) ? (c as string[]) : null
}

// ── priority ─────────────────────────────────────────────────────────────────────────

export function priorityPlan(def: AppDefinition): ScriptedReply {
  const wo = tableOf(def, 'work_orders')
  if (!wo)
    return { text: 'This app has no **Work orders** table, so there is nothing to add a priority to yet.' }
  const hasField = wo.fields.some((f) => f.key === 'priority')
  const at = wo.fields.findIndex((f) => f.key === 'status')
  const fieldIdx = at < 0 ? wo.fields.length : at + 1
  const field = {
    key: 'priority',
    name: 'Priority',
    type: 'single_select' as const,
    options: ['Low', 'Normal', 'Urgent'],
  }

  const colOps: ChangeInput['ops'] = []
  const formOps: ChangeInput['ops'] = []
  const tableNames: string[] = []
  const formNames: string[] = []
  for (const p of pages(def)) {
    for (const b of p.blocks) {
      const cols = columnsOf(b)
      if (sourceOf(b) !== 'work_orders' || !cols || cols.includes('priority')) continue
      if (b.type === 'table') {
        const i = cols.indexOf('status')
        colOps.push({
          op: 'add',
          path: `/interface/pages/${p.id}/blocks/${b.id}/props/columns/${i < 0 ? cols.length : i + 1}`,
          value: 'priority',
        })
        tableNames.push(`${p.name} › ${b.title ?? b.ref}`)
      } else if (b.type === 'form') {
        formOps.push({
          op: 'add',
          path: `/interface/pages/${p.id}/blocks/${b.id}/props/columns/-`,
          value: 'priority',
        })
        formNames.push(`${p.name} › ${b.title ?? b.ref}`)
      }
    }
  }

  const items: Omit<AiPlanItem, 'id' | 'status'>[] = []
  if (!hasField)
    items.push({
      area: 'Database',
      title: 'Add a “Priority” field to Work orders',
      detail: 'Choices: Low, Normal, Urgent. Existing records get Normal; nothing is deleted.',
      meta: `data.tables.work_orders.fields.priority = {\n  type: "single_select",\n  options: ["Low", "Normal", "Urgent"]\n}`,
      change: {
        key: 'data.tables.work_orders.fields.priority',
        area: 'Database',
        text: 'Added field Priority to Work orders',
        ops: [{ op: 'add', path: `/data/tables/work_orders/fields/${fieldIdx}`, value: field }],
      },
    })
  if (colOps.length)
    items.push({
      area: 'Pages',
      title: 'Show Priority in the work order lists',
      detail: `Adds a column next to Status in ${colOps.length} table${colOps.length === 1 ? '' : 's'}: ${tableNames.slice(0, 3).join(', ')}${tableNames.length > 3 ? '…' : ''}.`,
      meta: `pages.*.blocks[table, source = work_orders].columns += "priority"   (${colOps.length})`,
      change: {
        key: 'ai.priority.table_columns',
        area: 'Pages',
        text: 'Showed Priority in work order tables',
        ops: colOps,
      },
    })
  if (formOps.length)
    items.push({
      area: 'Pages',
      title: 'Let people set Priority in work order forms',
      detail: `Adds the field to ${formNames.join(', ')}.`,
      meta: `pages.*.blocks[form, source = work_orders].fields += "priority"   (${formOps.length})`,
      change: {
        key: 'ai.priority.form_fields',
        area: 'Pages',
        text: 'Added Priority to work order forms',
        ops: formOps,
      },
    })
  if (!items.length)
    return {
      text: 'Work orders already have a **Priority** field (`work_orders.priority`) and every work order list and form shows it. Want me to add a rule for urgent jobs instead?',
    }
  return {
    text: hasField
      ? 'Work orders already have a **Priority** field, but most lists don’t show it yet. Here’s my plan:'
      : 'Here’s my plan to add priorities. Uncheck anything you don’t want, then apply.',
    plan: plan('Add priority to work orders', 'Priority now shows in the work order lists and forms.', items),
  }
}

// ── translations ─────────────────────────────────────────────────────────────────────

const LANGS: Record<string, { name: string; words: Record<string, string> }> = {
  uz: {
    name: 'Uzbek (Oʻzbekcha)',
    words: {
      dashboard: 'Boshqaruv paneli',
      orders: 'Ish buyurtmalari',
      customers: 'Mijozlar',
      techs: 'Texniklar',
      schedule: 'Jadval',
      new: 'Yangi',
      scheduled: 'Rejalashtirilgan',
      in_progress: 'Jarayonda',
      waiting_on_parts: 'Ehtiyot qism kutilmoqda',
      done: 'Bajarildi',
    },
  },
  ru: {
    name: 'Russian (Русский)',
    words: {
      dashboard: 'Панель',
      orders: 'Заказы-наряды',
      customers: 'Клиенты',
      techs: 'Техники',
      schedule: 'Расписание',
      new: 'Новый',
      scheduled: 'Запланирован',
      in_progress: 'В работе',
      waiting_on_parts: 'Ждёт запчасти',
      done: 'Готово',
    },
  },
  es: {
    name: 'Spanish (Español)',
    words: {
      dashboard: 'Panel',
      orders: 'Órdenes de trabajo',
      customers: 'Clientes',
      techs: 'Técnicos',
      schedule: 'Agenda',
      new: 'Nuevo',
      scheduled: 'Programado',
      in_progress: 'En curso',
      waiting_on_parts: 'Esperando repuestos',
      done: 'Hecho',
    },
  },
}

export function translatePlan(def: AppDefinition, text: string): ScriptedReply {
  const t = text.toLowerCase()
  const lang = /russian|рус/.test(t) ? 'ru' : /spanish|español/.test(t) ? 'es' : 'uz'
  const L = LANGS[lang]!
  const pageIds = new Set(pages(def).map((p) => p.id))
  const states = new Set(def.workflows.flatMap((w) => w.states.map((s) => s.id)))
  const draft: Record<string, string> = {}
  for (const [k, v] of Object.entries(L.words)) {
    if (pageIds.has(k)) draft[`page.${k}`] = v
    else if (states.has(k)) draft[`status.${k}`] = v
  }
  const existing = def.translations[lang] ?? {}
  const missing = Object.fromEntries(Object.entries(draft).filter(([k]) => !(k in existing)))
  const n = Object.keys(missing).length
  const hasLang = def.settings.languages.includes(lang)
  if (hasLang && !n)
    return {
      text: `${L.name} is already set up and every page name and status I know has a translation. Open **Settings › Translations** to review them.`,
    }

  const items: Omit<AiPlanItem, 'id' | 'status'>[] = []
  if (!hasLang)
    items.push({
      area: 'Settings',
      title: `Add ${L.name} as a language`,
      detail: `${def.settings.defaultLanguage.toUpperCase()} stays the default.`,
      meta: `settings.languages += "${lang}"`,
      change: {
        key: `settings.languages.${lang}`,
        area: 'Settings',
        text: `Added language ${L.name}`,
        ops: [{ op: 'add', path: '/settings/languages/-', value: lang }],
      },
    })
  if (n) {
    const ops: ChangeInput['ops'] = def.translations[lang]
      ? Object.entries(missing).map(([k, v]) => ({
          op: 'add' as const,
          path: `/translations/${lang}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`,
          value: v,
        }))
      : [{ op: 'add', path: `/translations/${lang}`, value: missing }]
    items.push({
      area: 'Settings',
      title: 'Translate page names and work order statuses',
      detail: `${n} label${n === 1 ? '' : 's'} drafted. You can review each one in Settings › Translations.`,
      meta: `translations.${lang} = {\n${Object.entries(missing)
        .slice(0, 4)
        .map(([k, v]) => `  "${k}": "${v}"`)
        .join(',\n')}${n > 4 ? ',\n  …' : ''}\n}`,
      change: {
        key: `translations.${lang}`,
        area: 'Settings',
        text: `Drafted ${n} ${L.name} translations`,
        ops,
      },
    })
  }
  return {
    text: `I’ll add ${L.name} alongside the current languages:`,
    plan: plan(
      `Translate the app to ${L.name}`,
      `Switch the preview language to ${lang.toUpperCase()} to check the translations.`,
      items,
    ),
  }
}

// ── new page ─────────────────────────────────────────────────────────────────────────

export function pagePlan(def: AppDefinition, text: string): ScriptedReply {
  const m =
    /(?:page|screen)\s+(?:for|called|named|listing|of)\s+[“"']?([a-z][a-z ]{1,30}?)[”"']?(?:[.,!]|\s+(?:with|that|by|for|listing)\b|$)/i.exec(
      text,
    ) ??
    /(?:add|create|new|make|build)\s+(?:an?\s+)?[“"']?([a-z][a-z ]{1,30}?)[”"']?\s+(?:page|screen)\b/i.exec(
      text,
    )
  const name = (m?.[1]?.trim() || 'Equipment').replace(/^\w/, (c) => c.toUpperCase())
  const ids = pages(def).map((p) => p.id)
  const id = uniqueName(snake(name) || 'page', ids)
  const ordersIdx = ids.indexOf('orders')
  const page: Page = {
    id,
    name,
    icon: 'file-text',
    route: `/${id.replace(/_/g, '-')}`,
    inMenu: true,
    blocks: [
      {
        id: `${id}_h`,
        type: 'header',
        ref: 'pageHeader',
        row: 0,
        title: name,
        props: {
          subtitle: `Everything about ${name.toLowerCase()} in one place.`,
          buttonLabel: '',
          buttonWho: 'everyone',
        },
      },
      {
        id: `${id}_t`,
        type: 'table',
        ref: camelRef(name),
        row: 1,
        title: name,
        props: { source: 'work_orders', columns: ['ref', 'job', 'status', 'due'], filter: 'open' },
      },
    ],
  }
  const items: Omit<AiPlanItem, 'id' | 'status'>[] = [
    {
      area: 'Pages',
      title: `Add a “${name}” page`,
      detail: 'A header plus a table of open work orders you can point at another table later.',
      meta: `interface.pages.${id} = {\n  route: "${page.route}",\n  blocks: [header, table(work_orders)]\n}`,
      change: {
        key: `interface.pages.${id}`,
        area: 'Pages',
        text: `Added page ${name}`,
        ops: [{ op: 'add', path: `/interface/pages/${id}`, value: page }],
      },
    },
  ]
  if (ordersIdx >= 0)
    items.push({
      area: 'Pages',
      title: `Put ${name} in the menu after Work orders`,
      detail: 'Keeps related pages next to each other.',
      meta: `interface.navigation.move("${id}", after: "orders")`,
      change: {
        key: `interface.pages.${id}.order`,
        area: 'Pages',
        text: `Moved ${name} after Work orders`,
        ops: [{ op: 'move', from: `/interface/pages/${id}`, path: `/interface/pages/${ordersIdx + 1}` }],
      },
    })
  items.push({
    area: 'Permissions',
    title: `Hide ${name} from Customers`,
    detail: 'Admins, Dispatchers and Technicians can open it.',
    meta: `interface.pages.${id}.visibleTo = ["admin", "dispatcher", "technician"]`,
    change: {
      key: `interface.pages.${id}.visibleTo`,
      area: 'Permissions',
      text: `Limited ${name} to staff`,
      ops: [
        { op: 'add', path: `/interface/pages/${id}/visibleTo`, value: ['admin', 'dispatcher', 'technician'] },
      ],
    },
  })
  return {
    text: `Here’s a plan for a ${name} page:`,
    plan: plan(`Add the ${name} page`, `${name} is in the page menu at the top of the canvas.`, items),
  }
}

function camelRef(name: string): string {
  const p = pascal(name)
  return p[0]!.toLowerCase() + p.slice(1)
}

// ── access ───────────────────────────────────────────────────────────────────────────

export function accessPlan(def: AppDefinition): ScriptedReply {
  const tech = def.roles.find((r) => r.id === 'technician')
  if (!tech)
    return { text: 'There’s no **Technician** role in this app yet. Add one in Settings › Members first.' }
  const items: Omit<AiPlanItem, 'id' | 'status'>[] = []
  if (!tech.permissions.includes('work_orders.read.assigned'))
    items.push({
      area: 'Permissions',
      title: 'Technicians see only work orders assigned to them',
      detail:
        'Applies everywhere: lists, numbers, search and exports. Admins and Dispatchers still see everything.',
      meta: 'roles.technician.permissions: "work_orders.read" → "work_orders.read.assigned"',
      change: {
        key: 'roles.technician.permissions',
        area: 'Permissions',
        text: 'Technicians see only their assigned work orders',
        ops: [
          {
            op: 'replace',
            path: '/roles/technician/permissions',
            value: tech.permissions.map((p) => (p === 'work_orders.read' ? 'work_orders.read.assigned' : p)),
          },
        ],
      },
    })
  const techs = pages(def).find((p) => p.id === 'techs')
  if (techs && (!techs.visibleTo || techs.visibleTo.includes('technician')))
    items.push({
      area: 'Pages',
      title: 'Hide the Technicians page from technicians',
      detail: 'Removes it from their navigation.',
      meta: 'interface.pages.techs.visibleTo = ["admin", "dispatcher"]',
      change: {
        key: 'interface.pages.techs.visibleTo',
        area: 'Pages',
        text: 'Hid Technicians page from technicians',
        ops: [
          {
            op: techs.visibleTo ? 'replace' : 'add',
            path: '/interface/pages/techs/visibleTo',
            value: ['admin', 'dispatcher'],
          },
        ],
      },
    })
  const d3 = getAt<Block>(def, '/interface/pages/dashboard/blocks/d3')
  if (d3 && (d3.props as { filter?: string }).filter !== 'mine')
    items.push({
      area: 'Pages',
      title: 'Show “Assigned to me” on the Dashboard',
      detail: 'The Active jobs table lists the viewer’s own jobs.',
      meta: 'interface.pages.dashboard.blocks.d3.props.filter = "mine"',
      change: {
        key: 'interface.pages.dashboard.blocks.d3.props.filter',
        area: 'Pages',
        text: 'Dashboard shows the viewer’s own jobs',
        ops: [{ op: 'replace', path: '/interface/pages/dashboard/blocks/d3/props/filter', value: 'mine' }],
      },
    })
  if (!items.length)
    return {
      text: 'Technicians already see only their own work orders, and the Technicians page is hidden from them. Nothing to change.',
    }
  return {
    text: 'Here’s how I’d limit technicians to their own jobs:',
    plan: plan(
      'Technician-only access',
      'Try Preview as Technician — they now see only the jobs assigned to them.',
      items,
    ),
  }
}

// ── page script diff ─────────────────────────────────────────────────────────────────

export function pageIdFrom(path: string | undefined): string | undefined {
  return /^\/interface\/pages\/([^/]+)/.exec(path ?? '')?.[1]
}

export function codeDiff(
  def: AppDefinition,
  req: Pick<SendAiMessageRequest, 'context' | 'chips'>,
): ScriptedReply {
  const ctxPath =
    req.context?.path ??
    req.chips.find((c) => c.context?.path?.startsWith('/interface/pages/'))?.context?.path
  const page = pages(def).find((p) => p.id === pageIdFrom(ctxPath)) ?? pages(def).find((p) => p.script)
  if (!page?.script)
    return {
      text: 'This page has no page script yet. Switch the canvas to **Code** to create one, then ask me again.',
    }
  const lines = page.script.source.split('\n')
  const table = page.blocks.find((b) => b.type === 'table')?.ref ?? 'pageHeader'
  if (page.script.source.includes('ctx.every('))
    return { text: `${page.name} already refreshes on a timer. Tell me what to change inside that handler.` }
  const at = lines.findIndex((l) => /^\s{2}(async\s+)?onLoad\s*\(/.test(l))
  if (at < 0)
    return {
      text: `I couldn’t find \`onLoad\` in \`${page.script.file ?? page.id}\`. Add one and I’ll hook the refresh into it.`,
    }
  const add = [`    ctx.every(30_000, () => ctx.blocks.${table}.reload())`]
  const next = [...lines.slice(0, at + 1), ...add, ...lines.slice(at + 1)].join('\n')
  const out: AiDiffLine[] = [
    ...lines.slice(Math.max(0, at - 1), at + 1).map((s) => ({ k: ' ' as const, s })),
    ...add.map((s) => ({ k: '+' as const, s })),
    ...lines.slice(at + 1, at + 3).map((s) => ({ k: ' ' as const, s })),
  ]
  return {
    text: `Added a 30-second auto-refresh for \`${table}\` in \`onLoad()\`. The timer stops when the user leaves the page.`,
    diff: {
      id: newId('diff'),
      file: page.script.file ?? `pages/${page.id}.page.js`,
      lines: out,
      status: 'pending',
      change: {
        key: `interface.pages.${page.id}.script`,
        area: 'Pages',
        text: `Auto-refresh ${table} every 30 s on ${page.name}`,
        ops: [{ op: 'replace', path: `/interface/pages/${page.id}/script/source`, value: next }],
      },
    },
  }
}

// ── components: naming → generation → plan ──────────────────────────────────────────

export function nameIdeas(def: AppDefinition, prompt: string, kind: 'component' | 'page'): string[] {
  const words = prompt.replace(/^\/?create[- ](component|page)[:\s-]*/i, '').match(/[a-z]{4,}/gi) ?? []
  const stop = new Set([
    'show',
    'shows',
    'with',
    'that',
    'this',
    'what',
    'from',
    'when',
    'user',
    'users',
    'component',
    'page',
    'create',
    'make',
    'build',
    'have',
    'each',
    'their',
    'card',
  ])
  const base =
    pascal(
      words
        .filter((w) => !stop.has(w.toLowerCase()))
        .slice(0, 2)
        .join(' '),
    ) || 'Custom'
  let list = /rat|star/i.test(prompt)
    ? kind === 'page'
      ? ['RatingsPage', 'FeedbackPage', 'ReviewsView']
      : ['RatingStars', 'StarRating', 'FeedbackRating']
    : kind === 'page'
      ? [`${base}Page`, `${base}View`, base]
      : [/card/i.test(prompt) ? `${base}Card` : base, `${base}Panel`, `${base}List`]
  const taken = def.components.map((c) => c.name)
  list = [...new Set(list)].map((n) => uniqueName(n, taken))
  return list
}

export function namingReply(
  def: AppDefinition,
  text: string,
  kind: 'component' | 'page',
  askOnly: boolean,
): ScriptedReply {
  const folder = kind === 'page' ? 'pages' : 'components'
  if (askOnly)
    return {
      text: `What should the ${kind} do? Describe what it shows, what a page builder can change, and what happens on click. I’ll suggest a name, then write the \`.vue\` file in \`src/${folder}\` with its property fields.`,
    }
  return {
    text: `Got it. Before I write the file: what should I call this ${kind}? These names fit what you described.`,
    naming: { kind, folder, options: nameIdeas(def, text, kind), status: 'pending' },
  }
}

export function generatedProps(prompt: string): ComponentProp[] {
  if (/rat|star/i.test(prompt))
    return [
      { name: 'value', label: 'Value', type: 'Number', input: 'slider', required: true, default: 4 },
      { name: 'max', label: 'Stars', type: 'Number', input: 'number', required: false, default: 5 },
      { name: 'color', label: 'Colour', type: 'String', input: 'color', required: false, default: '#e0a100' },
      {
        name: 'readonly',
        label: 'Read only',
        type: 'Boolean',
        input: 'toggle',
        required: false,
        default: false,
      },
    ]
  return [
    {
      name: 'title',
      label: 'Title',
      type: 'String',
      input: 'text',
      required: false,
      default: 'Untitled',
      ai: true,
    },
    { name: 'items', label: 'Items', type: 'Array', input: 'source', required: true },
    { name: 'dense', label: 'Compact', type: 'Boolean', input: 'toggle', required: false, default: false },
  ]
}

/** RatingStars → component:rating_stars */
export const componentIdOf = (name: string) =>
  `component:${snake(name.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))}`

export const GEN_STEPS = [
  'Created the file in the sandbox',
  'Wrote template, script and styles',
  'Generated property fields',
]

export function componentGen(
  name: string,
  folder: 'components' | 'pages',
  step: number,
  props: ComponentProp[],
): AiComponentGen {
  return {
    name,
    file: `src/${folder}/${name}.vue`,
    componentId: componentIdOf(name),
    steps: GEN_STEPS.map((label, i) => ({
      label: i === 2 && step > 2 ? `${props.length} property fields generated` : label,
      state: i < step ? 'done' : i === step ? 'on' : 'todo',
    })),
    props: step > 2 ? props.map((p) => ({ name: p.name, type: p.type })) : [],
    status: step > 2 ? 'ready' : 'generating',
  }
}

export function componentReply(
  def: AppDefinition,
  naming: AiNaming,
  rawName: string,
  prompt: string,
): ScriptedReply {
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1)
  if (def.components.some((c) => c.name === name))
    return {
      text: `\`${name}\` already exists in \`src/${naming.folder}\`. Pick another name or type a new one.`,
    }
  const props = generatedProps(prompt)
  const comp: CustomComponent = {
    id: componentIdOf(name),
    kind: 'vue-component',
    name,
    folder: naming.folder,
    file: `src/${naming.folder}/${name}.vue`,
    source: { type: 'ai', prompt },
    props,
    events: [],
    status: 'needs_review',
  }
  return {
    note: `Following the project’s Agent.md and the Vue SFC conventions in src/${naming.folder}.`,
    text: `Creating **${name}.vue** in \`src/${naming.folder}\`, then generating its property fields. Apply the plan below to register it in the app definition.`,
    component: componentGen(name, naming.folder, 3, props),
    plan: plan(`Register ${name}`, `${name} is in the Components list — drop it on any page.`, [
      {
        area: 'Components',
        title: `Register ${name} with ${props.length} property fields`,
        detail: `Page builders can set ${props.map((p) => p.label).join(', ')}.`,
        meta: `components["${comp.id}"] = {\n  file: "${comp.file}",\n  props: [${props.map((p) => `"${p.name}"`).join(', ')}]\n}`,
        change: {
          key: `components.${comp.id}`,
          area: 'Components',
          text: `Generated component “${name}” in ${comp.file}`,
          ops: [{ op: 'add', path: `/components/${comp.id}`, value: comp }],
        },
      },
    ]),
  }
}

// ── explain / chat ───────────────────────────────────────────────────────────────────

const BLOCK_LABEL: Record<string, string> = {
  header: 'header',
  stats: 'numbers',
  table: 'table',
  form: 'form',
  text: 'text',
  button: 'button',
  image: 'image',
}

export function explainReply(
  def: AppDefinition,
  req: Pick<SendAiMessageRequest, 'context' | 'chips'>,
): ScriptedReply {
  const path = req.context?.path ?? req.chips.find((c) => c.context?.path)?.context?.path
  const fnId = /^\/logic\/functions\/([^/]+)/.exec(path ?? '')?.[1]
  const fn = fnId ? def.logic.functions.find((f) => f.id === fnId) : undefined
  if (fn)
    return {
      text: `**${fn.name}** takes ${fn.params.length ? fn.params.map((i) => `\`${i.name}\``).join(', ') : 'no input'} and runs ${fn.steps.length} top-level step${fn.steps.length === 1 ? '' : 's'}:\n\n${fn.steps
        .slice(0, 6)
        .map((s, i) => `${i + 1}. \`${s.type}\``)
        .join('\n')}\n\nAsk me to add a step or explain one of them in detail.`,
    }
  const tId = /^\/data\/tables\/([^/]+)/.exec(path ?? '')?.[1]
  const table = tId ? tableOf(def, tId) : undefined
  if (table)
    return {
      text: `**${table.name}** has ${table.fields.length} fields:\n\n${table.fields.map((f) => `- \`${f.key}\` — ${f.name} (${f.type.replace(/_/g, ' ')}${f.req ? ', required' : ''})`).join('\n')}\n\nRecords are never sent to me — only the structure.`,
    }
  const page = pages(def).find((p) => p.id === pageIdFrom(path)) ?? pages(def)[0]
  if (!page) return { text: 'This app has no pages yet.' }
  const who = page.visibleTo?.length
    ? `Only ${page.visibleTo.map((r) => def.roles.find((x) => x.id === r)?.name ?? r).join(', ')} can open it.`
    : 'Every role can open it.'
  return {
    text: `The **${page.name}** page (\`${page.route}\`) has ${page.blocks.length} blocks:\n\n${page.blocks
      .map(
        (b) =>
          `- **${b.title ?? b.ref}** — ${BLOCK_LABEL[b.type] ?? b.type}${sourceOf(b) ? ` of \`${String(sourceOf(b))}\`` : ''}`,
      )
      .join(
        '\n',
      )}\n\n${who}${page.script ? ` It also has a page script (\`${page.script.file ?? 'page.js'}\`).` : ''}`,
  }
}

const CHAT_TEXT =
  'I can change this app for you — I always show a **plan** first and nothing changes until you apply it. Try:\n\n' +
  '- “Add a priority to work orders”\n- “Translate the app to Uzbek”\n- “Create a page for equipment”\n- “Technicians should only see their own jobs”\n\n' +
  'Type `/` for skills or `@` to attach a page, table or function as context.'

// ── entry point ──────────────────────────────────────────────────────────────────────

export function noteFor(req: Pick<SendAiMessageRequest, 'chips' | 'recentEdits'>): string {
  const ctx = req.chips.filter((c) => c.kind === 'ctx')
  const parts: string[] = []
  if (ctx.length) parts.push(`Using ${ctx.map((c) => c.label).join(', ')} as context.`)
  const edits = req.recentEdits ?? []
  if (edits.length)
    parts.push(
      `I can see ${edits.length === 1 ? 'your recent edit' : `${edits.length} edits you made`} in the editor: ${edits.slice(-2).join('; ')}.`,
    )
  parts.push('Following the project’s Agent.md.')
  return parts.join(' ')
}

/** Find the naming picker a reply answers (explicit, or the last pending one). */
export function pendingNaming(convo: AiConversation, namingFor?: string): AiMessage | undefined {
  if (namingFor) return convo.messages.find((m) => m.id === namingFor && m.naming?.status === 'pending')
  return [...convo.messages].reverse().find((m) => m.naming?.status === 'pending')
}

export function scriptReply(
  def: AppDefinition,
  req: SendAiMessageRequest,
  convo: AiConversation,
): ScriptedReply {
  const naming = pendingNaming(convo, req.namingFor)
  if (
    naming?.naming &&
    (req.namingFor || (!req.chips.length && /^[A-Za-z][A-Za-z0-9]*$/.test(req.text.trim())))
  ) {
    const prompt =
      [...convo.messages]
        .reverse()
        .find(
          (m) =>
            m.role === 'user' &&
            m.id !== naming.id &&
            convo.messages.indexOf(m) < convo.messages.indexOf(naming),
        )?.text ?? req.text
    return componentReply(def, naming.naming, req.text.trim(), prompt)
  }
  const intent = detectIntent(req)
  const note = noteFor(req)
  const skill = req.chips.find((c) => c.kind === 'skill')?.skill
  let r: ScriptedReply
  switch (intent) {
    case 'priority':
      r = priorityPlan(def)
      break
    case 'translate':
      r = translatePlan(def, req.text)
      break
    case 'page':
      r = pagePlan(def, req.text)
      break
    case 'access':
      r = accessPlan(def)
      break
    case 'code':
      r = codeDiff(def, req)
      break
    case 'component':
      r = namingReply(
        def,
        req.text,
        skill === 'create-page' ? 'page' : 'component',
        !!skill && !req.text.trim(),
      )
      break
    case 'explain':
      r = explainReply(def, req)
      break
    case 'ask_table':
      r = {
        text: 'Sure. What should the new table track? For example: “Vehicles, with plate number, assigned technician and next service date.” I’ll propose fields and links before changing anything.',
      }
      break
    case 'ask_workflow':
      r = {
        text: 'Which records should it run on? Work orders already have a workflow (New → Scheduled → In progress → Waiting on parts → Done). I can add a state, a transition rule, or an approval step.',
      }
      break
    default:
      r = { text: CHAT_TEXT }
  }
  return { note, ...r }
}

// ── seeded history ───────────────────────────────────────────────────────────────────

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

function msg(role: AiMessage['role'], text: string, at: string, extra: Partial<AiMessage> = {}): AiMessage {
  return { id: newId('msg'), role, text, createdAt: at, ...extra }
}

function applied(p: AiPlan): AiPlan {
  return { ...p, status: 'applied', items: p.items.map((i) => ({ ...i, status: 'applied' })) }
}

/** Past conversations (mockup PAST_CHATS) adapted to the FieldOps definition. */
export function seedConversations(): AiConversation[] {
  const ctxChip = (label: string, path: string, icon: string): AiChip => ({
    kind: 'ctx',
    key: `ctx:${path}`,
    label,
    icon,
    context: { kind: 'page', path, label },
  })
  const h1At = ago(26)
  const h1Plan = applied(
    plan('Keep the Dashboard internal', '', [
      {
        area: 'Permissions',
        title: 'Hide the Dashboard from Customers',
        detail: 'Customers land on Work orders instead.',
        meta: 'interface.pages.dashboard.visibleTo = ["admin", "dispatcher", "technician"]',
        change: {
          key: 'interface.pages.dashboard.visibleTo',
          area: 'Permissions',
          text: 'Hid Dashboard from customers',
          ops: [
            {
              op: 'replace',
              path: '/interface/pages/dashboard/visibleTo',
              value: ['admin', 'dispatcher', 'technician'],
            },
          ],
        },
      },
    ]),
  )
  const h2At = ago(31)
  const h2Plan = applied(
    plan('Add “Waiting on parts”', '', [
      {
        area: 'Workflow',
        title: 'Add “Waiting on parts” state',
        detail: 'Technicians can move jobs in and out of it.',
        meta: 'workflows.work_order.states += "waiting_on_parts"',
        change: {
          key: 'workflows.work_order.states.waiting_on_parts',
          area: 'Workflow',
          text: 'Added state Waiting on parts',
          ops: [
            {
              op: 'test',
              path: '/workflows/work_order/states/waiting_on_parts/id',
              value: 'waiting_on_parts',
            },
          ],
        },
      },
    ]),
  )
  const h4At = ago(52)
  const h4Plan = plan('Show hours on Technician profile', 'Hours now show in Assigned jobs.', [
    {
      area: 'Pages',
      title: 'Add “Hours logged” to Assigned jobs',
      detail: 'The Technician profile table gets an Hours column at the end.',
      meta: 'interface.pages.tech_profile.blocks.tp3.props.columns += "hours"',
      change: {
        key: 'interface.pages.tech_profile.blocks.tp3.props.columns',
        area: 'Pages',
        text: 'Showed hours on Technician profile',
        ops: [
          { op: 'add', path: '/interface/pages/tech_profile/blocks/tp3/props/columns/-', value: 'hours' },
        ],
      },
    },
  ])
  const h3At = ago(24 * 9)
  const convos: Omit<
    AiConversation,
    'messageCount' | 'appliedCount' | 'hasPendingPlan' | 'snippet' | 'title'
  >[] = [
    {
      id: 'conv_h1',
      createdAt: h1At,
      updatedAt: h1At,
      by: 'Jordan Lee',
      messages: [
        msg('user', 'Customers can open the Dashboard and see every job. Hide it from them.', h1At, {
          author: 'Jordan Lee',
          chips: [ctxChip('Page: Dashboard', '/interface/pages/dashboard', 'layout-dashboard')],
        }),
        msg('assistant', 'Here’s a plan to keep the Dashboard internal:', h1At, {
          plan: h1Plan,
          note: 'Using Page: Dashboard as context. Following the project’s Agent.md.',
        }),
        msg('assistant', 'Applied 1 of 1 change. Preview as Customer to check.', h1At, { links: true }),
      ],
    },
    {
      id: 'conv_h2',
      createdAt: h2At,
      updatedAt: h2At,
      by: 'Maya Chen',
      messages: [
        msg('user', 'Jobs often stall because parts are missing. Add a state for that.', h2At, {
          author: 'Maya Chen',
        }),
        msg('assistant', 'I’ll add a “Waiting on parts” state between In progress and Done:', h2At, {
          plan: h2Plan,
        }),
        msg('assistant', 'Applied 1 of 1 change.', h2At, { links: true }),
      ],
    },
    {
      id: 'conv_h4',
      createdAt: h4At,
      updatedAt: h4At,
      by: 'Maya Chen',
      messages: [
        msg('user', 'Dispatchers want to see hours on the technician profile.', h4At, {
          author: 'Maya Chen',
        }),
        msg('assistant', 'Here’s a small plan for that:', h4At, { plan: h4Plan }),
      ],
    },
    {
      id: 'conv_h3',
      createdAt: h3At,
      updatedAt: h3At,
      by: 'Maya Chen',
      messages: [
        msg('user', 'Why can’t customers open the Technicians page?', h3At, { author: 'Maya Chen' }),
        msg(
          'assistant',
          'The **Technicians** page is visible to Admin, Dispatcher and Technician only. Customers don’t have access, so it’s hidden from their navigation.\n\nWant me to make a read-only version for them?',
          h3At,
        ),
        msg('user', 'No, that’s right. Thanks.', h3At, { author: 'Maya Chen' }),
      ],
    },
  ]
  return convos.map((c) =>
    summarize({ ...c, title: '', messageCount: 0, appliedCount: 0, hasPendingPlan: false, snippet: '' }),
  )
}

export function titleOf(messages: AiMessage[]): string {
  const u = messages.find((m) => m.role === 'user')?.text ?? ''
  if (!u) return 'New conversation'
  return u.length > 46 ? `${u.slice(0, 44)}…` : u
}

/** Recompute the summary fields of a conversation after it changed. */
export function summarize(c: AiConversation): AiConversation {
  const last = c.messages.at(-1)
  return {
    ...c,
    title: titleOf(c.messages),
    messageCount: c.messages.length,
    appliedCount: c.messages.reduce(
      (a, m) =>
        a +
        (m.plan?.status === 'applied' ? m.plan.items.filter((i) => i.status === 'applied').length : 0) +
        (m.diff?.status === 'applied' ? 1 : 0),
      0,
    ),
    hasPendingPlan: c.messages.some((m) => m.plan?.status === 'pending' || m.diff?.status === 'pending'),
    snippet: last ? last.text.replace(/[*`_#>]/g, '').slice(0, 140) : '',
  }
}
