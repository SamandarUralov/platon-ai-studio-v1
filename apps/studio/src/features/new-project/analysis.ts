/**
 * Stand-in for the AI brief. There is no "analyse my prompt and documents" endpoint yet
 * (requirements §6 only define POST /projects), so the brief is derived locally from the prompt.
 * When the backend ships one, replace `analyze()` with a call — the flow only depends on `Brief`.
 */

export interface Brief {
  name: string
  /** One-sentence purpose shown on the brief card. */
  purpose: string
  /** Shorter purpose for the summary card and the created project's description. */
  tagline: string
  requirements: string[]
}

const FIELD_OPS: Brief = {
  name: 'FieldOps',
  purpose:
    'A mobile-first work order app: dispatchers plan and assign jobs, technicians work them on site, customers follow their own.',
  tagline: 'Work orders for field technicians — dispatch, on-site logging and a customer portal.',
  requirements: [
    'Dispatchers create jobs with customer, site, priority, due date and technician',
    'Technicians see today’s jobs in route order on their phone',
    'Technicians log time, parts and before/after photos per job',
    'Jobs move New → Assigned → In progress → Waiting on parts → Done',
    'Customers see only their own jobs and can request new ones',
    'SMS to the customer when the technician is on the way',
    'Nightly export of completed jobs and parts to the ERP',
    'Managers see weekly hours and first-time-fix rate',
  ],
}

const KNOWN: [RegExp, string][] = [
  [/purchase|procure|budget/i, 'Purchase Approvals'],
  [/onboard/i, 'Client Onboarding'],
  [/inspect|checklist/i, 'Inspections'],
  [/leave|vacation|time off/i, 'Leave Requests'],
  [/invent|stock|warehouse/i, 'Inventory'],
  [/help ?desk|ticket|support/i, 'Help Desk'],
]

const STOP = new Set(
  'a an the app application for to of and or our my we with that which where who in on at by from new simple tool portal system platform should must can will be is are'.split(
    ' ',
  ),
)

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Short, human app name from a free-text description, e.g. "FieldOps", "Purchase Approvals". */
export function deriveName(prompt: string): string {
  if (/field|technician|work ?order/i.test(prompt)) return FIELD_OPS.name
  for (const [re, name] of KNOWN) if (re.test(prompt)) return name
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
  return words.length ? words.slice(0, 2).map(cap).join(' ') : 'New app'
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/[.!?]+$/, ''))
    .filter(Boolean)
}

export function analyze(prompt: string): Brief {
  const text = prompt.trim()
  if (!text || /field|technician|work ?order/i.test(text)) return FIELD_OPS
  const parts = sentences(text)
  // Clauses ("managers approve within budget, finance pays") read as individual requirements.
  const requirements = parts
    .flatMap((s) => s.split(/[,;]\s+|\s+—\s+/))
    .map((s) => cap(s.trim()))
    .filter((s) => s.length > 6)
  const purpose = parts[0] ? cap(parts[0]) + '.' : text
  return {
    name: deriveName(text),
    purpose,
    tagline: purpose,
    requirements: requirements.length ? requirements : [purpose],
  }
}

/** Fake per-document finding shown once a file is "read". */
const FINDINGS = [
  '9 requirements found',
  'Job lifecycle · 4 roles',
  'Parts table · 412 rows',
  'Customer portal · 3 screens',
  '6 entities, 2 workflows',
]
export const findingFor = (i: number) => FINDINGS[i % FINDINGS.length]!
