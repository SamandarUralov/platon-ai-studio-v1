/**
 * Component sandbox seed (F14): the `.vue` sources behind the FieldOps custom components, plus the mock
 * "Studio AI" generator used by `POST /components:generate`. Sources are kept in sync with the
 * `components` entries of the FieldOps definition so they open as "in sync".
 */
import type { CommunityComponent, ComponentProp, CustomComponent, SandboxFile } from '@platon/definition'

export interface SandboxEntry extends SandboxFile {
  content: string
}

const TS = '2026-10-01T09:30:00.000Z'

const JOB_TIMELINE = `<template>
  <section :class="['job-timeline', size]">
    <header class="jt-head">
      <h3>{{ title }}</h3>
      <span v-if="showProgress" class="jt-pct">{{ percent }}%</span>
    </header>
    <ol class="jt-steps">
      <li v-for="step in steps" :key="step.id" :class="{ done: step.done }" @click="emit('stepClick', step)">
        <span class="jt-dot"></span>
        <div>
          <strong>{{ step.label }}</strong>
          <small>{{ step.at }}</small>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Job progress' },
  steps: { type: Array, required: true },
  accent: { type: String, default: '#0e7c66' },
  showProgress: { type: Boolean, default: true },
  size: { type: String, default: 'comfortable', validator: (v) => ['compact', 'comfortable'].includes(v) },
})
const emit = defineEmits(['stepClick'])

const percent = computed(() => {
  const done = props.steps.filter((s) => s.done).length
  return props.steps.length ? Math.round((done / props.steps.length) * 100) : 0
})
</script>

<style scoped>
.job-timeline { padding: 16px; border-radius: 12px; background: #fff; }
.job-timeline.compact { padding: 10px; }
.jt-head { display: flex; justify-content: space-between; }
.jt-dot { width: 10px; height: 10px; border-radius: 50%; background: #d4d6e0; }
.done .jt-dot { background: v-bind(accent); }
</style>
`

const SIGNATURE_PAD = `<template>
  <div :class="['signature-pad', { readonly }]">
    <label>{{ label }}</label>
    <canvas ref="pad" @pointerdown="start" @pointermove="draw" @pointerup="end"></canvas>
    <button type="button" :disabled="readonly" @click="clear">Clear</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  label: { type: String, default: 'Customer signature' },
  readonly: { type: Boolean, default: false },
  penColor: { type: String, default: '#17182a' },
})
const emit = defineEmits(['sign', 'clear'])

const pad = ref(null)
let drawing = false

function start(e) { if (props.readonly) return; drawing = true; ctx().beginPath(); ctx().moveTo(e.offsetX, e.offsetY) }
function draw(e) { if (!drawing) return; ctx().lineTo(e.offsetX, e.offsetY); ctx().stroke() }
function end() { drawing = false; emit('sign', pad.value.toDataURL()) }
function clear() { ctx().clearRect(0, 0, 9999, 9999); emit('clear') }
function ctx() { const c = pad.value.getContext('2d'); c.strokeStyle = props.penColor; return c }
</script>

<style scoped>
.signature-pad canvas { width: 100%; height: 160px; border: 1px dashed #c9cad6; border-radius: 8px; }
.signature-pad.readonly canvas { opacity: .6; }
</style>
`

export function sandboxSeed(): SandboxEntry[] {
  return [
    {
      path: 'src/components/JobTimeline.vue',
      componentId: 'component:job_timeline',
      origin: 'ai',
      size: JOB_TIMELINE.length,
      updatedAt: TS,
      content: JOB_TIMELINE,
    },
    {
      path: 'src/components/SignaturePad.vue',
      componentId: 'component:signature_pad',
      origin: 'code',
      size: SIGNATURE_PAD.length,
      updatedAt: TS,
      content: SIGNATURE_PAD,
    },
  ]
}

// ── Mock "Studio AI" generator ─────────────────────────────────────────────────────────────────

const kebab = (n: string) => n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const snake = (n: string) => kebab(n).replace(/-/g, '_')

function defJs(p: ComponentProp): string {
  const d = p.default
  if (p.type === 'Array')
    return p.input === 'source' || d == null || d === '' ? '() => []' : `() => ${JSON.stringify(d)}`
  if (p.type === 'Object')
    return p.input === 'record' || d == null || d === '' ? '() => ({})' : `() => (${JSON.stringify(d)})`
  if (p.type === 'Boolean') return d === true || d === 'true' ? 'true' : 'false'
  if (p.type === 'Number') return String(Number(d) || 0)
  return `'${String(d ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")}'`
}

function propsBlock(ps: ComponentProp[]): string {
  const line = (p: ComponentProp) =>
    `  ${p.name}: { type: ${p.type}${p.required ? ', required: true' : `, default: ${defJs(p)}`}${
      p.input === 'select' && p.options?.length
        ? `, validator: (v) => [${p.options.map((o) => `'${o}'`).join(', ')}].includes(v)`
        : ''
    } },`
  return `const props = defineProps({\n${ps.map(line).join('\n')}${ps.length ? '\n' : ''}})`
}

function sfc(template: string[], ps: ComponentProp[], emits: string[], style: string[]): string {
  return `${template.join('\n')}\n\n<script setup>\n${propsBlock(ps)}\nconst emit = defineEmits([${emits.map((e) => `'${e}'`).join(', ')}])\n</script>\n\n<style scoped>\n${style.join('\n')}\n</style>\n`
}

const STOP = new Set(
  'a an the for with that to of and our show shows component page which in on from by each my it its is list card who their all this before after starts start'.split(
    ' ',
  ),
)

/** Deterministic stand-in for the AI: picks a shape from the prompt and writes a matching SFC. */
export function generateComponent(
  prompt: string,
  name: string | undefined,
  folder: 'components' | 'pages',
  taken: string[],
): { component: CustomComponent; source: string } {
  const unique = (n: string) => {
    let out = n
    let i = 2
    while (taken.includes(out)) out = `${n}${i++}`
    return out
  }
  let n: string
  let props: ComponentProp[]
  let source: string
  let events: string[]
  if (/rat|star/i.test(prompt)) {
    n = unique(name || 'RatingStars')
    const k = kebab(n)
    props = [
      {
        name: 'value',
        label: 'Value',
        type: 'Number',
        input: 'number',
        required: false,
        default: 0,
        ai: true,
      },
      {
        name: 'max',
        label: 'Number of stars',
        type: 'Number',
        input: 'slider',
        required: false,
        default: 5,
        ai: true,
      },
      {
        name: 'readonly',
        label: 'Read only',
        type: 'Boolean',
        input: 'toggle',
        required: false,
        default: false,
        ai: true,
      },
      {
        name: 'color',
        label: 'Star colour',
        type: 'String',
        input: 'color',
        required: false,
        default: '#f5a524',
        ai: true,
      },
    ]
    events = ['change']
    source = sfc(
      [
        '<template>',
        `  <div class="${k}" role="radiogroup">`,
        '    <button v-for="n in max" :key="n" type="button" :disabled="readonly"',
        `      :class="{ on: n <= value }" @click="emit('change', n)">★</button>`,
        '  </div>',
        '</template>',
      ],
      props,
      events,
      [
        `.${k} { display: flex; gap: 4px; }`,
        `.${k} button { font-size: 22px; color: #d4d6e0; background: none; border: 0; }`,
        `.${k} button.on { color: v-bind(color); }`,
      ],
    )
  } else {
    const words = (prompt.match(/[A-Za-z]+/g) ?? []).filter((w) => !STOP.has(w.toLowerCase())).slice(0, 2)
    const base = words.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join('') || 'Custom'
    n = unique(name || base + (/card/i.test(prompt) ? 'Card' : /checklist/i.test(prompt) ? '' : 'Block'))
    const k = kebab(n)
    const title = words.length
      ? words
          .join(' ')
          .toLowerCase()
          .replace(/^./, (x) => x.toUpperCase())
      : 'Title'
    props = [
      {
        name: 'title',
        label: 'Title',
        type: 'String',
        input: 'text',
        required: false,
        default: title,
        ai: true,
      },
      { name: 'items', label: 'Items', type: 'Array', input: 'source', required: true, ai: true },
      {
        name: 'accent',
        label: 'Accent colour',
        type: 'String',
        input: 'color',
        required: false,
        default: '#4f5bea',
        ai: true,
      },
      {
        name: 'compact',
        label: 'Compact',
        type: 'Boolean',
        input: 'toggle',
        required: false,
        default: false,
        ai: true,
      },
    ]
    events = ['select']
    source = sfc(
      [
        '<template>',
        `  <div :class="['${k}', { compact }]">`,
        '    <h3>{{ title }}</h3>',
        '    <ul>',
        `      <li v-for="item in items" :key="item.id" @click="emit('select', item)">`,
        '        {{ item.name }}',
        '      </li>',
        '    </ul>',
        '  </div>',
        '</template>',
      ],
      props,
      events,
      [
        `.${k} { padding: 16px; border-radius: 12px; border-top: 3px solid v-bind(accent); }`,
        `.${k}.compact { padding: 8px; }`,
      ],
    )
  }
  return {
    component: {
      id: `component:${snake(n)}`,
      kind: 'vue-component',
      name: n,
      folder,
      file: `src/${folder}/${n}.vue`,
      source: { type: 'ai', prompt },
      props,
      events,
      status: 'needs_review',
    },
    source,
  }
}

// ── Community catalog ──────────────────────────────────────────────────────────────────────────

const str = (name: string, label: string, def: string): ComponentProp => ({
  name,
  label,
  type: 'String',
  input: 'text',
  required: false,
  default: def,
})
const color = (def: string): ComponentProp => ({
  name: 'accent',
  label: 'Accent colour',
  type: 'String',
  input: 'color',
  required: false,
  default: def,
})

interface CommunityEntry extends CommunityComponent {
  template: string[]
  style: string[]
}

const COMMUNITY: CommunityEntry[] = [
  {
    id: 'community:status_timeline',
    name: 'StatusTimeline',
    description: 'Vertical history of status changes with who and when.',
    author: 'Platon Labs',
    installs: 1840,
    tags: ['timeline', 'history', 'audit'],
    props: [
      str('title', 'Title', 'History'),
      { name: 'items', label: 'Entries', type: 'Array', input: 'source', required: true },
      color('#4f5bea'),
    ],
    events: ['select'],
    template: [
      '<template>',
      '  <section class="status-timeline">',
      '    <h3>{{ title }}</h3>',
      '    <ol>',
      `      <li v-for="item in items" :key="item.id" @click="emit('select', item)">`,
      '        <strong>{{ item.status }}</strong> <small>{{ item.by }} · {{ item.at }}</small>',
      '      </li>',
      '    </ol>',
      '  </section>',
      '</template>',
    ],
    style: [
      '.status-timeline ol { list-style: none; margin: 0; padding: 0 0 0 12px; border-left: 2px solid v-bind(accent); }',
      '.status-timeline li { padding: 6px 0; cursor: pointer; }',
    ],
  },
  {
    id: 'community:rating_stars',
    name: 'RatingStars',
    description: 'Star rating input for feedback and quality checks.',
    author: 'Aziz K.',
    installs: 1203,
    tags: ['rating', 'feedback', 'form'],
    props: [
      { name: 'value', label: 'Value', type: 'Number', input: 'number', required: false, default: 0 },
      { name: 'max', label: 'Number of stars', type: 'Number', input: 'slider', required: false, default: 5 },
      color('#f59e0b'),
    ],
    events: ['change'],
    template: [
      '<template>',
      '  <div class="rating-stars">',
      `    <button v-for="n in max" :key="n" :class="{ on: n <= value }" @click="emit('change', n)">★</button>`,
      '  </div>',
      '</template>',
    ],
    style: [
      '.rating-stars button { border: 0; background: none; font-size: 20px; color: #cbd5e1; cursor: pointer; }',
      '.rating-stars button.on { color: v-bind(accent); }',
    ],
  },
  {
    id: 'community:map_pin',
    name: 'MapPin',
    description: 'Static map card that shows an address with a pin.',
    author: 'GeoTools',
    installs: 742,
    tags: ['map', 'address', 'location'],
    props: [str('address', 'Address', 'Amir Temur 1, Tashkent'), str('label', 'Label', 'Site')],
    events: ['open'],
    template: [
      '<template>',
      `  <figure class="map-pin" @click="emit('open', address)">`,
      '    <div class="map-pin__map">📍</div>',
      '    <figcaption><strong>{{ label }}</strong> {{ address }}</figcaption>',
      '  </figure>',
      '</template>',
    ],
    style: [
      '.map-pin { margin: 0; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; cursor: pointer; }',
      '.map-pin__map { height: 120px; display: grid; place-items: center; background: #e0f2fe; font-size: 28px; }',
      '.map-pin figcaption { padding: 10px 12px; }',
    ],
  },
  {
    id: 'community:countdown',
    name: 'Countdown',
    description: 'Time left until a deadline, for SLAs and due dates.',
    author: 'Platon Labs',
    installs: 515,
    tags: ['sla', 'deadline', 'timer'],
    props: [str('label', 'Label', 'Due in'), str('until', 'Deadline (ISO date)', '2026-12-31')],
    events: [],
    template: [
      '<template>',
      '  <div class="countdown"><span>{{ label }}</span> <strong>{{ until }}</strong></div>',
      '</template>',
    ],
    style: ['.countdown { padding: 12px 16px; border-radius: 10px; background: #f1f5f9; }'],
  },
]

const publicEntry = ({ template: _t, style: _s, ...c }: CommunityEntry): CommunityComponent => c

export function communityCatalog(q = ''): CommunityComponent[] {
  const s = q.trim().toLowerCase()
  return COMMUNITY.filter(
    (c) => !s || `${c.name} ${c.description} ${c.tags.join(' ')}`.toLowerCase().includes(s),
  ).map(publicEntry)
}

/** Copy of a community component for one project, renamed when the name is already taken. */
export function installCommunity(
  communityId: string,
  taken: string[],
): { component: CustomComponent; source: string } | null {
  const c = COMMUNITY.find((x) => x.id === communityId)
  if (!c) return null
  let n = c.name
  for (let i = 2; taken.includes(n); i++) n = `${c.name}${i}`
  return {
    component: {
      id: `component:${snake(n)}`,
      kind: 'vue-component',
      name: n,
      folder: 'components',
      file: `src/components/${n}.vue`,
      source: { type: 'code' },
      props: c.props,
      events: c.events,
      status: 'reviewed',
    },
    source: sfc(c.template, c.props, c.events, c.style),
  }
}
