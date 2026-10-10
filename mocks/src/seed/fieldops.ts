/**
 * FieldOps Service Desk — the example app used across the mockups and requirements,
 * expressed in the app-definition schema. Ported from the v4 mockup `seed()` / LOGIC_DEFAULT.
 */
import type {
  AppDefinition,
  Api,
  Block,
  BlockType,
  Cron,
  LogicFunction,
  Page,
  Queue,
  Step,
  StepType,
  TypedField,
} from '@platon/definition'

// ── step builder (deterministic ids so seed data and tests are stable) ──────────────
let sid = 0
function step(type: StepType, config: Record<string, string>, branches?: [string, Step[]][]): Step {
  const id = `s${++sid}`
  const s: Step = { id, type, config }
  if (branches) s.branches = branches.map(([label, steps]) => ({ id: `b${++sid}`, label, steps }))
  else if (type === 'if')
    s.branches = [['Then', []] as const, ['Else', []] as const].map(([label]) => ({
      id: `b${++sid}`,
      label,
      steps: [],
    }))
  return s
}
const ret = (v: string) => step('return', { from: 'var', value: v })

function params(sig: string): TypedField[] {
  return sig
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [name, type] = x.split(':').map((y) => y.trim())
      return { name: name!, type: type ?? 'string', req: true }
    })
}
const f = (name: string, type: string, req = true, fields?: TypedField[]): TypedField => ({
  name,
  type,
  req,
  ...(fields ? { fields } : {}),
})

// ── data ─────────────────────────────────────────────────────────────────────────────
const TABLE_OF: Record<string, string> = {
  orders: 'work_orders',
  customers: 'customers',
  technicians: 'technicians',
  parts: 'parts_used',
}

// ── pages ────────────────────────────────────────────────────────────────────────────
type RawBlock = {
  id: string
  type: BlockType
  title?: string
  subtitle?: string
  button?: string
  buttonWho?: string
  source?: string
  columns?: string[]
  filter?: string
  items?: string[]
  text?: string
  submit?: string
  action?: string
  style?: Block['style']
}

const LABEL: Partial<Record<BlockType, string>> = {
  image: 'Image',
  text: 'Text',
  button: 'Button',
  table: 'Table',
  form: 'Form',
}

function camel(t: string) {
  const w = t
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const r = w.map((x, i) => (i ? x[0]!.toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase())).join('')
  return /^\d/.test(r) ? `b${r}` : r
}

function blocks(raw: RawBlock[]): Block[] {
  const used = new Set<string>()
  return raw.map((b, row) => {
    let ref =
      b.type === 'header'
        ? 'pageHeader'
        : b.type === 'stats'
          ? 'numbers'
          : camel(b.title ?? LABEL[b.type] ?? b.type) + (b.type === 'form' ? 'Form' : '')
    let x = ref
    let i = 2
    while (used.has(x)) x = ref + i++
    ref = x
    used.add(ref)
    const props: Record<string, unknown> = {}
    if (b.subtitle !== undefined) props.subtitle = b.subtitle
    if (b.type === 'header') {
      props.buttonLabel = b.button ?? ''
      props.buttonWho = b.buttonWho ?? 'everyone'
    }
    if (b.source) props.source = TABLE_OF[b.source] ?? b.source
    if (b.columns) props.columns = b.columns
    if (b.filter) props.filter = b.filter
    if (b.items) props.items = b.items
    if (b.text) props.text = b.text
    if (b.submit) props.submitLabel = b.submit
    if (b.action) props.action = b.action
    return {
      id: b.id,
      type: b.type,
      ref,
      row,
      ...(b.title ? { title: b.title } : {}),
      props,
      ...(b.style ? { style: b.style } : {}),
    }
  })
}

const R = {
  Admin: 'admin',
  Dispatcher: 'dispatcher',
  Technician: 'technician',
  Customer: 'customer',
} as const
const roles = (...r: (keyof typeof R)[]) => r.map((x) => R[x])

function page(
  id: string,
  name: string,
  icon: string,
  raw: RawBlock[],
  opts: { under?: string; route?: string; visibleTo?: (keyof typeof R)[] } = {},
): Page {
  return {
    id,
    name,
    icon,
    route: opts.route ?? `/${id.replace(/_/g, '-')}`,
    ...(opts.under ? { parent: opts.under } : {}),
    inMenu: !opts.under,
    ...(opts.visibleTo ? { visibleTo: roles(...opts.visibleTo) } : {}),
    blocks: blocks(raw),
  }
}

export const ORDERS_CODE = `// Work orders · page logic
// Runs in the browser. Server work goes through ctx.call().
export default definePage({
  state: { filter: 'open', selected: null },

  computed: {
    overdue: (ctx) => ctx.blocks.allWorkOrders.rows.filter(r => r.due < ctx.today()),
  },

  async onLoad(ctx) {
    await ctx.blocks.allWorkOrders.load({ status: ctx.state.filter })
    ctx.log('Loaded work orders')
  },

  on: {
    'numbers.click': (ctx, stat) => {
      ctx.state.filter = stat.key
      ctx.blocks.allWorkOrders.load({ status: stat.key })
    },
    'allWorkOrders.rowClick': async (ctx, row) => {
      ctx.state.selected = row
      if (!row.tech) {
        const tech = await ctx.call('assignNearestTech', row.ref)
        ctx.toast('Assigned to ' + tech.name)
      }
    },
    'pageHeader.buttonClick': (ctx) => {
      ctx.navigate('/orders/new')
    },
  },
})
`

const PAGES: Page[] = [
  page(
    'dashboard',
    'Dashboard',
    'layout-dashboard',
    [
      {
        id: 'd1',
        type: 'header',
        style: { bg: '#e3f5ef', pad: 28, radius: 16 },
        title: 'Good morning, team',
        subtitle: "Here's what's happening across your field operations today.",
        button: '',
      },
      { id: 'd2', type: 'stats', items: ['open', 'today', 'waiting', 'done'] },
      {
        id: 'd3',
        type: 'table',
        title: 'Active jobs',
        source: 'orders',
        columns: ['ref', 'job', 'tech', 'status'],
        filter: 'open',
      },
    ],
    { visibleTo: ['Admin', 'Dispatcher', 'Technician'] },
  ),
  page(
    'orders',
    'Work orders',
    'clipboard-list',
    [
      {
        id: 'o1',
        type: 'header',
        title: 'Work orders',
        subtitle: 'Track every job from request to sign-off.',
        button: 'New work order',
        buttonWho: 'staff',
      },
      { id: 'o2', type: 'stats', items: ['open', 'waiting', 'done'] },
      {
        id: 'o3',
        type: 'table',
        title: 'All work orders',
        source: 'orders',
        columns: ['ref', 'job', 'customer', 'tech', 'status', 'due'],
        filter: 'none',
      },
    ],
    { route: '/orders' },
  ),
  page(
    'order_detail',
    'Work order details',
    'file-text',
    [
      {
        id: 'od1',
        type: 'header',
        title: 'WO-1042 · Boiler service',
        subtitle: 'Riverside Clinic · due Oct 9',
        button: 'Mark as done',
        buttonWho: 'staff',
      },
      {
        id: 'od2',
        type: 'form',
        title: 'Job details',
        source: 'orders',
        columns: ['job', 'customer', 'tech', 'status', 'due', 'hours'],
        submit: 'Save changes',
      },
      {
        id: 'od3',
        type: 'table',
        title: 'Parts used',
        source: 'parts',
        columns: ['part', 'qty', 'cost'],
        filter: 'none',
      },
      { id: 'od4', type: 'image', title: 'Site photos' },
    ],
    { under: 'orders', route: '/work-orders/:id' },
  ),
  page(
    'order_new',
    'New work order',
    'square-plus',
    [
      {
        id: 'on1',
        type: 'header',
        title: 'New work order',
        subtitle: 'Log a request and assign a technician.',
        button: '',
      },
      {
        id: 'on2',
        type: 'form',
        title: 'Request',
        source: 'orders',
        columns: ['job', 'customer', 'tech', 'due'],
        submit: 'Create work order',
      },
      {
        id: 'on3',
        type: 'text',
        text: 'Urgent jobs are dispatched to the nearest available technician automatically.',
      },
    ],
    { under: 'orders', route: '/work-orders/new', visibleTo: ['Admin', 'Dispatcher'] },
  ),
  page(
    'order_checklist',
    'Job checklist',
    'list-checks',
    [
      {
        id: 'oc1',
        type: 'header',
        title: 'Job checklist',
        subtitle: 'Complete every step before sign-off.',
        button: '',
      },
      {
        id: 'oc2',
        type: 'text',
        text: '1. Isolate power and water. 2. Inspect and photograph. 3. Replace worn parts. 4. Test and get customer signature.',
      },
      { id: 'oc3', type: 'image', title: 'Before / after photo' },
      { id: 'oc4', type: 'button', title: 'Request customer signature', action: 'form' },
    ],
    { under: 'orders', route: '/work-orders/:id/checklist' },
  ),
  page(
    'customers',
    'Customers',
    'building-2',
    [
      {
        id: 'c1',
        type: 'header',
        title: 'Customers',
        subtitle: 'Companies and sites you service.',
        button: 'Add customer',
        buttonWho: 'staff',
      },
      {
        id: 'c2',
        type: 'table',
        title: 'All customers',
        source: 'customers',
        columns: ['name', 'contact', 'city', 'plan'],
        filter: 'none',
      },
    ],
    { visibleTo: ['Admin', 'Dispatcher'] },
  ),
  page(
    'customer_detail',
    'Customer details',
    'building',
    [
      {
        id: 'cd1',
        type: 'header',
        title: 'Riverside Clinic',
        subtitle: 'Premium plan · Portland',
        button: 'New job',
        buttonWho: 'staff',
      },
      {
        id: 'cd2',
        type: 'form',
        title: 'Company',
        source: 'customers',
        columns: ['name', 'contact', 'city', 'plan'],
        submit: 'Save',
      },
      {
        id: 'cd3',
        type: 'table',
        title: 'Job history',
        source: 'orders',
        columns: ['ref', 'job', 'status', 'due'],
        filter: 'none',
      },
    ],
    { under: 'customers', route: '/customers/:id', visibleTo: ['Admin', 'Dispatcher'] },
  ),
  page(
    'sites',
    'Sites',
    'map-pin',
    [
      {
        id: 'si1',
        type: 'header',
        title: 'Sites',
        subtitle: 'Locations you service for this customer.',
        button: 'Add site',
        buttonWho: 'staff',
      },
      {
        id: 'si2',
        type: 'table',
        title: 'All sites',
        source: 'customers',
        columns: ['name', 'city'],
        filter: 'none',
      },
      { id: 'si3', type: 'image', title: 'Site map' },
    ],
    { under: 'customers', route: '/customers/:id/sites', visibleTo: ['Admin', 'Dispatcher'] },
  ),
  page(
    'techs',
    'Technicians',
    'hard-hat',
    [
      {
        id: 't1',
        type: 'header',
        title: 'Technicians',
        subtitle: 'Who is on the team and where they work.',
        button: '',
      },
      {
        id: 't2',
        type: 'table',
        title: 'Team',
        source: 'technicians',
        columns: ['name', 'region', 'skills'],
        filter: 'none',
      },
    ],
    { route: '/technicians', visibleTo: ['Admin', 'Dispatcher', 'Technician'] },
  ),
  page(
    'tech_profile',
    'Technician profile',
    'user-round',
    [
      {
        id: 'tp1',
        type: 'header',
        title: 'Dana Ruiz',
        subtitle: 'North region · HVAC, Plumbing',
        button: '',
      },
      { id: 'tp2', type: 'stats', items: ['open', 'done'] },
      {
        id: 'tp3',
        type: 'table',
        title: 'Assigned jobs',
        source: 'orders',
        columns: ['ref', 'job', 'status', 'due'],
        filter: 'open',
      },
    ],
    { under: 'techs', route: '/technicians/:id' },
  ),
  page(
    'timesheets',
    'Timesheets',
    'timer',
    [
      {
        id: 'ts1',
        type: 'header',
        title: 'Timesheets',
        subtitle: 'Hours logged per job this week.',
        button: 'Log hours',
        buttonWho: 'everyone',
      },
      {
        id: 'ts2',
        type: 'table',
        title: 'This week',
        source: 'orders',
        columns: ['ref', 'tech', 'hours', 'status'],
        filter: 'none',
      },
      { id: 'ts3', type: 'text', text: 'Timesheets lock every Monday at 9:00.' },
    ],
    { under: 'techs', route: '/technicians/timesheets' },
  ),
  page(
    'vehicles',
    'Vehicles',
    'truck',
    [
      {
        id: 'vh1',
        type: 'header',
        title: 'Vehicles',
        subtitle: 'Vans, who drives them and when they’re due for service.',
        button: 'Add vehicle',
        buttonWho: 'staff',
      },
      {
        id: 'vh2',
        type: 'table',
        title: 'Fleet',
        source: 'technicians',
        columns: ['name', 'region'],
        filter: 'none',
      },
    ],
    { under: 'techs', route: '/technicians/vehicles', visibleTo: ['Admin', 'Dispatcher'] },
  ),
  page('schedule', 'Schedule', 'calendar-days', [
    {
      id: 'sc1',
      type: 'header',
      title: 'Schedule',
      subtitle: 'Upcoming visits by day and technician.',
      button: 'Assign job',
      buttonWho: 'staff',
    },
    { id: 'sc2', type: 'stats', items: ['today', 'open'] },
    {
      id: 'sc3',
      type: 'table',
      title: 'This week',
      source: 'orders',
      columns: ['due', 'job', 'tech', 'status'],
      filter: 'open',
    },
  ]),
  page(
    'dispatch',
    'Dispatch board',
    'map-pinned',
    [
      {
        id: 'ds1',
        type: 'header',
        title: 'Dispatch board',
        subtitle: 'Drag unassigned jobs to a technician.',
        button: '',
      },
      {
        id: 'ds2',
        type: 'table',
        title: 'Unassigned',
        source: 'orders',
        columns: ['ref', 'job', 'customer', 'due'],
        filter: 'open',
      },
      {
        id: 'ds3',
        type: 'table',
        title: 'Technicians on shift',
        source: 'technicians',
        columns: ['name', 'region'],
        filter: 'none',
      },
    ],
    { under: 'schedule', route: '/schedule/dispatch', visibleTo: ['Admin', 'Dispatcher'] },
  ),
  page('requests', 'Service requests', 'inbox', [
    {
      id: 'rq1',
      type: 'header',
      title: 'Service requests',
      subtitle: 'New requests from customers, waiting to become work orders.',
      button: 'New request',
      buttonWho: 'everyone',
    },
    { id: 'rq2', type: 'stats', items: ['open', 'today'] },
    {
      id: 'rq3',
      type: 'table',
      title: 'Waiting for review',
      source: 'orders',
      columns: ['job', 'customer', 'due', 'status'],
      filter: 'open',
    },
  ]),
  page(
    'request_detail',
    'Request details',
    'message-square-text',
    [
      {
        id: 'rd1',
        type: 'header',
        title: 'Leak above server room',
        subtitle: 'Lumen Data · submitted Oct 7, 8:14 AM',
        button: 'Convert to work order',
        buttonWho: 'staff',
      },
      {
        id: 'rd2',
        type: 'form',
        title: 'Request',
        source: 'orders',
        columns: ['job', 'customer', 'due'],
        submit: 'Save',
      },
      { id: 'rd3', type: 'image', title: 'Photos from customer' },
    ],
    { under: 'requests', route: '/requests/:id' },
  ),
  page('inventory', 'Inventory', 'package', [
    {
      id: 'in1',
      type: 'header',
      title: 'Inventory',
      subtitle: 'Parts in stock and what has been used on jobs.',
      button: 'Add part',
      buttonWho: 'staff',
    },
    {
      id: 'in2',
      type: 'table',
      title: 'Recently used',
      source: 'parts',
      columns: ['part', 'order', 'qty', 'cost'],
      filter: 'none',
    },
  ]),
  page(
    'invoices',
    'Invoices',
    'file-spreadsheet',
    [
      {
        id: 'iv1',
        type: 'header',
        title: 'Invoices',
        subtitle: 'Bill customers for completed jobs.',
        button: 'New invoice',
        buttonWho: 'staff',
      },
      { id: 'iv2', type: 'stats', items: ['done', 'waiting'] },
      {
        id: 'iv3',
        type: 'table',
        title: 'Ready to bill',
        source: 'orders',
        columns: ['ref', 'customer', 'hours', 'status'],
        filter: 'none',
      },
    ],
    { visibleTo: ['Admin', 'Dispatcher'] },
  ),
  page(
    'reports',
    'Reports',
    'chart-line',
    [
      { id: 'rp1', type: 'header', title: 'Reports', subtitle: 'How the team is performing.', button: '' },
      { id: 'rp2', type: 'stats', items: ['open', 'today', 'waiting', 'done'] },
      { id: 'rp3', type: 'image', title: 'Jobs per week chart' },
    ],
    { visibleTo: ['Admin', 'Dispatcher'] },
  ),
  page(
    'app_settings',
    'Settings',
    'settings',
    [
      {
        id: 'as1',
        type: 'header',
        title: 'Settings',
        subtitle: 'Company details and preferences.',
        button: '',
      },
      {
        id: 'as2',
        type: 'form',
        title: 'Company',
        source: 'customers',
        columns: ['name', 'contact', 'city'],
        submit: 'Save',
      },
    ],
    { visibleTo: ['Admin'] },
  ),
]

PAGES.find((p) => p.id === 'orders')!.script = {
  lang: 'js',
  file: 'pages/orders.page.js',
  source: ORDERS_CODE,
  bindings: ['numbers.click', 'allWorkOrders.rowClick', 'pageHeader.buttonClick'],
  calls: ['assignNearestTech'],
}
PAGES.find((p) => p.id === 'orders')!.lifecycle = {
  onPageInit: [{ id: 'lc1', kind: 'code', code: "ctx.state.filter = ctx.route.query.status ?? 'open'" }],
  onBeforeRender: [
    {
      id: 'lc2',
      kind: 'code',
      code: "// Customers can see orders but not create them\nctx.blocks.pageHeader.buttonDisabled = ctx.user.role === 'Customer'",
    },
  ],
  onPageReady: [
    {
      id: 'lc3',
      kind: 'function',
      fn: 'listWorkOrders',
      args: { status: 'ctx.state.filter', cursor: 'null' },
    },
  ],
}

// ── logic ────────────────────────────────────────────────────────────────────────────
function fn(
  id: string,
  name: string,
  sig: string,
  returns: LogicFunction['returns'],
  timeout: string,
  steps: Step[],
  pkg?: string,
): LogicFunction {
  return { id, name, params: params(sig), returns, timeout, steps, ...(pkg ? { package: pkg } : {}) }
}

const FUNCTIONS: LogicFunction[] = [
  fn(
    'calc_sla_due',
    'calcSlaDue',
    'order_id: string',
    { type: 'datetime' },
    '10 s',
    [
      step('select', { table: 'work_orders', where: 'id = :input.order_id', limit: '1', into: 'order' }),
      step('select', { table: 'sites', where: 'id = :order.site_id', limit: '1', into: 'site' }),
      step('switch', { value: 'order.priority', cases: 'urgent, high' }, [
        ['Case urgent', [step('set', { name: 'hours', value: '4' })]],
        ['Case high', [step('set', { name: 'hours', value: '24' })]],
        ['Default', [step('set', { name: 'hours', value: '72' })]],
      ]),
      step('set', { name: 'result', value: 'addBusinessHours(order.created_at, hours, site.timezone)' }),
      ret('result'),
    ],
    'work_orders',
  ),
  fn(
    'assign_nearest_tech',
    'assignNearestTech',
    'order_id: string, trade: string',
    { type: 'object', fields: [f('assigned', 'boolean'), f('technician', 'string', false)] },
    '30 s',
    [
      step('select', { table: 'work_orders', where: 'id = :input.order_id', limit: '1', into: 'order' }),
      step('select', {
        table: 'technicians',
        where: 'on_shift = true AND skill = :input.trade',
        limit: '50',
        into: 'techs',
      }),
      step('if', { condition: 'techs.length == 0' }, [
        [
          'Then',
          [
            step('produce', {
              queue: 'work_order_events',
              message: '{ "type": "no_tech_available", "order_id": order.id }',
            }),
            step('set', { name: 'result', value: '{ assigned: false }' }),
            ret('result'),
          ],
        ],
        [
          'Else',
          [
            step('set', { name: 'best', value: 'nearest(techs, order.location)' }),
            step('execute', {
              sql: "UPDATE work_orders SET technician_id = :best.id, status = 'scheduled' WHERE id = :order.id",
            }),
            step('produce', {
              queue: 'sms_outbound',
              message: '{ "to": best.phone, "text": "New job " + order.id }',
            }),
            step('set', { name: 'result', value: '{ assigned: true, technician: best.id }' }),
            ret('result'),
          ],
        ],
      ]),
    ],
    'dispatch',
  ),
  fn(
    'generate_invoice_pdf',
    'generateInvoicePdf',
    'order_id: string',
    { type: 'string' },
    '60 s',
    [
      step('select', { table: 'work_orders', where: 'id = :input.order_id', limit: '1', into: 'order' }),
      step('select', { table: 'parts_used', where: 'order_id = :order.id', limit: '200', into: 'parts' }),
      step('set', { name: 'total', value: 'order.labor_cost' }),
      step('for', { list: 'parts', as: 'part' }, [
        ['Each part', [step('set', { name: 'total', value: 'total + part.price * part.qty' })]],
      ]),
      step('http', {
        method: 'POST',
        url: 'https://pdf.acme-facilities.internal/render',
        body: '{ "template": "invoice", "order": order, "total": total }',
        into: 'pdf',
      }),
      step('set', { name: 'result', value: 'pdf.url' }),
      ret('result'),
    ],
    'billing',
  ),
  fn(
    'send_customer_sms',
    'sendCustomerSms',
    'to: string, text: string',
    { type: 'object', fields: [f('status', 'integer')] },
    '10 s',
    [
      step('http', {
        method: 'POST',
        url: 'https://api.sms-gateway.io/send',
        body: '{ "to": input.to, "text": input.text }',
        into: 'res',
      }),
      step('if', { condition: 'res.status != 200' }, [
        [
          'Then',
          [
            step('produce', {
              queue: 'sms_outbound',
              message: '{ "to": input.to, "text": input.text, "retry": true }',
            }),
          ],
        ],
        ['Else', []],
      ]),
      step('set', { name: 'result', value: 'res.body' }),
      ret('result'),
    ],
    'notifications',
  ),
  fn(
    'handle_order_events',
    'handleOrderEvents',
    '',
    { type: 'any' },
    '30 s',
    [
      step('consume', { queue: 'work_order_events', into: 'msg' }),
      step('switch', { value: 'msg.type', cases: 'work_order.created, part.shipped' }, [
        [
          'Case work_order.created',
          [step('call', { fn: 'assignNearestTech', args: 'msg.order_id, msg.trade', into: 'result' })],
        ],
        [
          'Case part.shipped',
          [step('execute', { sql: "UPDATE work_orders SET status = 'scheduled' WHERE id = :msg.order_id" })],
        ],
        ['Default', []],
      ]),
    ],
    'dispatch',
  ),
  fn(
    'list_work_orders',
    'listWorkOrders',
    'status: string, cursor: string',
    { type: 'object', fields: [f('items', 'array<work_orders>'), f('next', 'string', false)] },
    '10 s',
    [
      step('select', { table: 'work_orders', where: 'status = :input.status', limit: '50', into: 'items' }),
      step('set', { name: 'result', value: '{ items, next: last(items).id }' }),
      ret('result'),
    ],
    'work_orders',
  ),
  fn(
    'create_work_order',
    'createWorkOrder',
    'site_id: string, trade: string, priority: string, description: string',
    { type: 'object', fields: [f('id', 'string')] },
    '10 s',
    [
      step('execute', {
        sql: "INSERT INTO work_orders (site_id, trade, priority, description, status) VALUES (:input.site_id, :input.trade, :input.priority, :input.description, 'new')",
      }),
      step('produce', {
        queue: 'work_order_events',
        message: '{ "type": "work_order.created", "order_id": last_insert_id }',
      }),
      step('set', { name: 'result', value: '{ id: last_insert_id }' }),
      ret('result'),
    ],
    'work_orders',
  ),
  fn(
    'update_order_status',
    'updateOrderStatus',
    'order_id: string, status: string',
    { type: 'object', fields: [f('ok', 'boolean'), f('error', 'string', false)] },
    '10 s',
    [
      step('select', { table: 'work_orders', where: 'id = :input.order_id', limit: '1', into: 'order' }),
      step('if', { condition: 'canTransition(order.status, input.status)' }, [
        [
          'Then',
          [
            step('execute', { sql: 'UPDATE work_orders SET status = :input.status WHERE id = :order.id' }),
            step('set', { name: 'result', value: '{ ok: true }' }),
            ret('result'),
          ],
        ],
        [
          'Else',
          [step('set', { name: 'result', value: '{ ok: false, error: "Not allowed" }' }), ret('result')],
        ],
      ]),
    ],
    'work_orders',
  ),
  fn(
    'sync_parts_inventory',
    'syncPartsInventory',
    '',
    { type: 'any' },
    '60 s',
    [
      step('http', {
        method: 'GET',
        url: 'https://parts-supplier.example.com/inventory',
        body: '',
        into: 'feed',
      }),
      step('for', { list: 'feed.items', as: 'item' }, [
        [
          'Each item',
          [
            step('execute', {
              sql: 'INSERT INTO parts_used (part_no, stock) VALUES (:item.part_no, :item.stock) ON CONFLICT (part_no) DO UPDATE SET stock = :item.stock',
            }),
          ],
        ],
      ]),
    ],
    'billing',
  ),
]

const JSON_CT = 'application/json'
const emptyReq = (body: TypedField[] = [], extra: Partial<Api['request']> = {}): Api['request'] => ({
  contentType: JSON_CT,
  path: [],
  headers: [],
  query: [],
  body,
  ...extra,
})
const errs = (): Api['responses'] => ({
  '400': {
    contentType: JSON_CT,
    fields: [
      f('error', 'string'),
      f('details', 'array<object>', false, [f('field', 'string'), f('problem', 'string')]),
    ],
  },
  '401': { contentType: JSON_CT, fields: [f('error', 'string')] },
  '403': { contentType: JSON_CT, fields: [f('error', 'string')] },
  '500': {
    contentType: JSON_CT,
    fields: [f('error', 'string'), f('step', 'string', false), f('message', 'string')],
  },
})

const APIS: Api[] = [
  {
    id: 'get_work_orders',
    protocol: 'rest',
    method: 'GET',
    path: '/api/work-orders',
    package: 'work_orders',
    access: { type: 'token', who: 'any', roles: [], perms: [] },
    request: emptyReq([], { query: [f('status', 'string', false), f('cursor', 'string', false)] }),
    responses: {
      '200': {
        contentType: JSON_CT,
        fields: [
          f('items', 'array<object>', true, [
            f('id', 'string'),
            f('status', 'string'),
            f('priority', 'string'),
          ]),
          f('next', 'string', false),
        ],
      },
      ...errs(),
    },
    cache: { enabled: true, ttl: '30 s', varyBy: ['status'] },
    steps: [
      step('call', { fn: 'listWorkOrders', args: 'input.status, input.cursor', into: 'page' }),
      ret('page'),
    ],
  },
  {
    id: 'post_work_orders',
    protocol: 'rest',
    method: 'POST',
    path: '/api/work-orders',
    package: 'work_orders',
    access: { type: 'token', who: 'roles', roles: ['Dispatcher', 'Admin'], perms: [] },
    request: emptyReq([
      f('site_id', 'string'),
      f('trade', 'string'),
      f('priority', 'enum'),
      f('description', 'string'),
    ]),
    responses: {
      '200': {
        contentType: JSON_CT,
        fields: [f('id', 'string'), f('assigned', 'boolean'), f('sla_due', 'datetime', false)],
      },
      ...errs(),
    },
    steps: [
      step('call', {
        fn: 'createWorkOrder',
        args: 'input.site_id, input.trade, input.priority, input.description',
        into: 'order',
      }),
      step('call', { fn: 'assignNearestTech', args: 'order.id, input.trade', into: 'assignment' }),
      step('call', { fn: 'calcSlaDue', args: 'order.id', into: 'slaDue' }),
    ],
  },
  {
    id: 'patch_status',
    protocol: 'rest',
    method: 'PATCH',
    path: '/api/work-orders/:id/status',
    package: 'work_orders',
    access: { type: 'token', who: 'roles', roles: ['Technician', 'Dispatcher'], perms: [] },
    request: emptyReq([f('status', 'string')], { path: [f('id', 'string')] }),
    responses: { '200': { contentType: JSON_CT, fields: [f('ok', 'boolean')] }, ...errs() },
    steps: [step('call', { fn: 'updateOrderStatus', args: 'input.id, input.status', into: 'result' })],
  },
  {
    id: 'parts_webhook',
    protocol: 'rest',
    method: 'POST',
    path: '/api/webhooks/parts-supplier',
    package: 'integrations',
    access: { type: 'basic', who: 'roles', roles: [], perms: ['parts.write'] },
    request: emptyReq([f('order_id', 'string'), f('event', 'string'), f('eta', 'date', false)]),
    responses: { '200': { contentType: JSON_CT, fields: [f('ok', 'boolean')] }, ...errs() },
    // Calls updateOrderStatus with one argument: a deliberate problem the Problems tab shows.
    steps: [step('call', { fn: 'updateOrderStatus', args: 'input.order_id', into: 'result' })],
  },
  {
    id: 'erp_update_status',
    protocol: 'soap',
    method: 'POST',
    path: '/soap/work-orders',
    service: 'WorkOrderService',
    operation: 'UpdateStatus',
    package: 'integrations',
    access: { type: 'token', who: 'any', roles: [], perms: [] },
    request: {
      contentType: 'text/xml; charset=utf-8',
      path: [],
      headers: [],
      query: [],
      body: [f('id', 'string'), f('status', 'string')],
    },
    responses: {
      Response: {
        contentType: 'text/xml; charset=utf-8',
        fields: [f('ok', 'boolean'), f('updated_at', 'datetime', false)],
      },
      Fault: {
        contentType: 'text/xml; charset=utf-8',
        fields: [f('faultcode', 'string'), f('faultstring', 'string')],
      },
    },
    steps: [step('call', { fn: 'updateOrderStatus', args: 'input.id, input.status', into: 'result' })],
  },
  {
    id: 'grpc_assign_tech',
    protocol: 'grpc',
    method: 'POST',
    path: '/fieldops.v1.Dispatch/AssignTechnician',
    service: 'fieldops.v1.Dispatch',
    operation: 'AssignTechnician',
    package: 'integrations',
    access: { type: 'token', who: 'any', roles: [], perms: [] },
    request: {
      contentType: 'application/grpc+proto',
      path: [],
      headers: [],
      query: [],
      body: [f('order_id', 'string'), f('trade', 'string')],
    },
    responses: {
      OK: {
        contentType: 'application/grpc+proto',
        fields: [f('technician_id', 'string'), f('assigned', 'boolean')],
      },
      INVALID_ARGUMENT: { contentType: 'application/grpc+proto', fields: [f('message', 'string')] },
    },
    steps: [
      step('call', { fn: 'assignNearestTech', args: 'input.order_id, input.trade', into: 'assignment' }),
    ],
  },
]

const CRONS: Cron[] = [
  {
    id: 'nightly_sla',
    name: 'Nightly SLA check',
    schedule: '0 2 * * *',
    timezone: 'America/Los_Angeles',
    enabled: true,
    steps: [
      step('call', { fn: 'listWorkOrders', args: '"open", ""', into: 'openOrders' }),
      step('call', { fn: 'calcSlaDue', args: 'openOrders', into: 'due' }),
    ],
  },
  {
    id: 'weekly_report',
    name: 'Weekly ops report',
    schedule: '0 8 * * MON',
    timezone: 'America/Los_Angeles',
    enabled: true,
    steps: [
      step('call', { fn: 'listWorkOrders', args: '"done", ""', into: 'done' }),
      step('call', { fn: 'generateInvoicePdf', args: 'done', into: 'report' }),
    ],
  },
  {
    id: 'sync_inventory',
    name: 'Sync parts inventory',
    schedule: '*/15 * * * *',
    timezone: 'UTC',
    enabled: false,
    steps: [step('call', { fn: 'syncPartsInventory', args: '', into: '' })],
  },
]

const QUEUES: Queue[] = [
  {
    id: 'work_order_events',
    name: 'work-order-events',
    fields: params('type: string, order_id: string, at: datetime'),
    consumers: ['handleOrderEvents'],
    settings: {
      broker: 'rabbitmq',
      concurrency: 5,
      retries: 3,
      backoff: 'exponential',
      timeout: '30 s',
      ordered: false,
    },
  },
  {
    id: 'sms_outbound',
    name: 'sms-outbound',
    fields: [f('to', 'string'), f('text', 'string'), f('retry', 'boolean', false)],
    consumers: ['sendCustomerSms'],
    settings: {
      broker: 'rabbitmq',
      concurrency: 10,
      retries: 5,
      backoff: 'fixed',
      timeout: '10 s',
      ordered: false,
    },
  },
  {
    id: 'invoice_generation',
    name: 'invoice-generation',
    fields: params('order_id: string'),
    consumers: ['generateInvoicePdf'],
    settings: {
      broker: 'rabbitmq',
      concurrency: 2,
      retries: 3,
      backoff: 'exponential',
      timeout: '60 s',
      ordered: true,
    },
  },
]

// ── assembled definition ─────────────────────────────────────────────────────────────
export function fieldopsDefinition(): AppDefinition {
  return structuredClone({
    id: 'fieldops',
    name: 'FieldOps Service Desk',
    version: 142,
    settings: {
      slug: 'fieldops',
      defaultLanguage: 'en',
      timezone: 'America/Los_Angeles',
      languages: ['en', 'es'],
      theme: { color: '#0e7c66', mode: 'light', radius: 'soft' },
      signIn: ['password', 'eimzo', 'ldap', 'oneid', 'google'],
      modules: ['workflows', 'reports', 'notifications', 'file_storage', 'audit_log', 'scheduler'],
    },
    roles: [
      { id: 'admin', name: 'Admin', description: 'Everything, including settings', permissions: ['*'] },
      {
        id: 'dispatcher',
        name: 'Dispatcher',
        description: 'Creates and assigns work',
        permissions: ['work_orders.read', 'work_orders.write', 'work_orders.assign', 'invoices.read'],
      },
      {
        id: 'technician',
        name: 'Technician',
        description: 'Works assigned jobs',
        permissions: ['work_orders.read', 'parts.write'],
      },
      {
        id: 'customer',
        name: 'Customer',
        description: 'Sees their company’s jobs',
        permissions: ['work_orders.read'],
      },
    ],
    interface: { navigation: { type: 'sidebar' }, pages: PAGES },
    data: {
      connections: [
        {
          id: 'main',
          name: 'FieldOps database',
          engine: 'postgres',
          role: 'primary',
          host: 'pg.acme-facilities.internal',
          port: 5432,
          database: 'fieldops',
          schema: 'public',
          ssl: true,
          credentials: {
            development: 'secret://main/development',
            staging: 'secret://main/staging',
            production: 'secret://main/production',
          },
        },
        {
          id: 'cache',
          name: 'Session cache',
          engine: 'redis',
          role: 'cache',
          host: 'redis.acme-facilities.internal',
          port: 6379,
          database: '0',
          ssl: true,
          credentials: { development: 'secret://cache/development', staging: 'secret://cache/staging' },
        },
      ],
      tables: [
        {
          id: 'work_orders',
          name: 'Work orders',
          icon: 'clipboard-list',
          connection: 'main',
          fields: [
            { key: 'ref', name: '#', type: 'auto_number' },
            { key: 'job', name: 'Job', type: 'text', req: true },
            { key: 'customer', name: 'Customer', type: 'link', req: true, link: 'customers' },
            { key: 'tech', name: 'Technician', type: 'link', link: 'technicians' },
            { key: 'status', name: 'Status', type: 'workflow_state', req: true, workflow: 'work_order' },
            { key: 'due', name: 'Due', type: 'date' },
            { key: 'hours', name: 'Hours logged', type: 'number' },
            { key: 'photos', name: 'Photos', type: 'file', storage: 'field_files' },
          ],
        },
        {
          id: 'customers',
          name: 'Customers',
          icon: 'building-2',
          connection: 'main',
          fields: [
            { key: 'name', name: 'Company', type: 'text', req: true },
            { key: 'contact', name: 'Contact', type: 'text' },
            { key: 'city', name: 'City', type: 'text' },
            { key: 'plan', name: 'Service plan', type: 'single_select', options: ['Standard', 'Premium'] },
          ],
        },
        {
          id: 'technicians',
          name: 'Technicians',
          icon: 'hard-hat',
          connection: 'main',
          fields: [
            { key: 'name', name: 'Name', type: 'text', req: true },
            { key: 'region', name: 'Region', type: 'single_select', options: ['North', 'Central', 'South'] },
            {
              key: 'skills',
              name: 'Skills',
              type: 'multi_select',
              options: ['HVAC', 'Electrical', 'Plumbing', 'Fire safety', 'Access control'],
            },
            { key: 'login', name: 'Login', type: 'user_account' },
          ],
        },
        {
          id: 'parts_used',
          name: 'Parts used',
          icon: 'package',
          connection: 'main',
          fields: [
            { key: 'part', name: 'Part', type: 'text', req: true },
            { key: 'order', name: 'Work order', type: 'link', link: 'work_orders' },
            { key: 'qty', name: 'Quantity', type: 'number' },
            { key: 'cost', name: 'Unit cost', type: 'currency' },
          ],
        },
        {
          id: 'tech_sessions',
          name: 'Technician sessions',
          icon: 'key-round',
          connection: 'cache',
          ttl: '1 day',
          physicalName: 'fieldops:tech_sessions:{id}',
          fields: [
            { key: 'key', name: 'Key', type: 'text', req: true },
            { key: 'value', name: 'Value (Hash)', type: 'text' },
            { key: 'ttl', name: 'Expires in', type: 'text' },
          ],
        },
      ],
    },
    logic: {
      packages: [
        { id: 'work_orders', name: 'work_orders', kind: 'functions' },
        { id: 'dispatch', name: 'dispatch', kind: 'functions' },
        { id: 'billing', name: 'billing', kind: 'functions' },
        { id: 'notifications', name: 'notifications', kind: 'functions' },
        { id: 'api_work_orders', name: 'work_orders', kind: 'apis' },
        { id: 'api_integrations', name: 'integrations', kind: 'apis' },
      ],
      functions: FUNCTIONS,
      apis: APIS,
      crons: CRONS,
      queues: QUEUES,
    },
    storage: {
      object: [
        {
          id: 'field_files',
          name: 'Field files',
          provider: 'minio',
          purpose: 'files',
          endpoint: 'https://minio.acme-facilities.internal:9000',
          region: 'us-west-1',
          tls: true,
          credentials: {
            development: 'secret://field_files/development',
            staging: 'secret://field_files/staging',
            production: 'secret://field_files/production',
          },
          buckets: [
            { name: 'fieldops-photos', purpose: 'Work order photos', access: 'private', versioning: true },
            {
              name: 'fieldops-documents',
              purpose: 'Signed reports & invoices',
              access: 'signed',
              versioning: true,
            },
          ],
        },
      ],
      local: {
        root: '/var/platon/fieldops',
        folders: [
          {
            id: 'uploads',
            path: 'uploads',
            purpose: 'Form uploads before they move to MinIO',
            quota: '5 GB',
            access: 'rw',
            cleanup: '7d',
            backup: { enabled: true, target: 'field_files' },
          },
          {
            id: 'tmp',
            path: 'tmp',
            purpose: 'Scratch space for functions',
            quota: '2 GB',
            access: 'rw',
            cleanup: '1d',
            backup: { enabled: false },
          },
          {
            id: 'exports',
            path: 'exports',
            purpose: 'Generated CSV and PDF files',
            quota: '10 GB',
            access: 'rw',
            cleanup: '30d',
            backup: { enabled: true, target: 'field_files' },
          },
          {
            id: 'logs',
            path: 'logs',
            purpose: 'App and function logs',
            quota: '2 GB',
            access: 'read',
            cleanup: '14d',
            backup: { enabled: false },
          },
        ],
      },
    },
    workflows: [
      {
        id: 'work_order',
        name: 'Work order',
        table: 'work_orders',
        states: [
          { id: 'new', name: 'New', tone: 'neutral' },
          { id: 'scheduled', name: 'Scheduled', tone: 'primary' },
          { id: 'in_progress', name: 'In progress', tone: 'warn' },
          { id: 'waiting_on_parts', name: 'Waiting on parts', tone: 'purple' },
          { id: 'done', name: 'Done', tone: 'ok', final: true },
        ],
        transitions: [
          { from: 'new', to: 'scheduled', requires: 'Technician assigned', roles: ['admin', 'dispatcher'] },
          { from: 'scheduled', to: 'in_progress', roles: ['technician'] },
          { from: 'in_progress', to: 'waiting_on_parts', requires: 'Part noted', roles: ['technician'] },
          { from: 'waiting_on_parts', to: 'in_progress', roles: ['admin', 'dispatcher', 'technician'] },
          { from: 'in_progress', to: 'done', requires: 'Hours logged', roles: ['technician'] },
        ],
      },
    ],
    translations: {
      es: {
        'page.dashboard': 'Panel',
        'page.orders': 'Órdenes de trabajo',
        'page.customers': 'Clientes',
        'page.techs': 'Técnicos',
        'stat.open': 'Trabajos abiertos',
        'status.new': 'Nuevo',
        'status.scheduled': 'Programado',
        'status.in_progress': 'En curso',
        'status.done': 'Hecho',
      },
    },
    components: [
      {
        id: 'component:job_timeline',
        kind: 'vue-component',
        name: 'JobTimeline',
        folder: 'components',
        file: 'src/components/JobTimeline.vue',
        source: {
          type: 'ai',
          prompt: 'Vertical timeline of a work order’s status changes with a progress percentage.',
        },
        props: [
          {
            name: 'title',
            label: 'Title',
            type: 'String',
            input: 'text',
            required: false,
            default: 'Job progress',
            ai: true,
          },
          {
            name: 'steps',
            label: 'Steps',
            type: 'Array',
            input: 'source',
            required: true,
            default: 'Work order events',
          },
          {
            name: 'accent',
            label: 'Accent colour',
            type: 'String',
            input: 'color',
            required: false,
            default: '#0e7c66',
          },
          {
            name: 'showProgress',
            label: 'Show progress',
            type: 'Boolean',
            input: 'toggle',
            required: false,
            default: true,
          },
          {
            name: 'size',
            label: 'Size',
            type: 'String',
            input: 'select',
            required: false,
            default: 'comfortable',
            options: ['compact', 'comfortable'],
          },
        ],
        events: ['stepClick'],
        status: 'live',
      },
      {
        id: 'component:signature_pad',
        kind: 'vue-component',
        name: 'SignaturePad',
        folder: 'components',
        file: 'src/components/SignaturePad.vue',
        source: { type: 'code' },
        props: [
          {
            name: 'label',
            label: 'Label',
            type: 'String',
            input: 'text',
            required: false,
            default: 'Customer signature',
          },
          {
            name: 'readonly',
            label: 'Read only',
            type: 'Boolean',
            input: 'toggle',
            required: false,
            default: false,
          },
          {
            name: 'penColor',
            label: 'Pen colour',
            type: 'String',
            input: 'color',
            required: false,
            default: '#17182a',
          },
        ],
        events: ['sign', 'clear'],
        status: 'needs_review',
      },
    ],
  } satisfies AppDefinition)
}
