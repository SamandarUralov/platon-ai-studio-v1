/**
 * Cron helpers: human text (cronstrue) and the next run times in the cron's timezone.
 * Supports the standard 5-field syntax: `*`, lists, ranges, steps and MON/JAN names.
 */
import cronstrue from 'cronstrue'

export function describeCron(expr: string): string | null {
  try {
    return cronstrue.toString(expr, {
      use24HourTimeFormat: true,
      throwExceptionOnParseError: true,
      verbose: false,
    })
  } catch {
    return null
  }
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

interface Field {
  set: Set<number>
  any: boolean
}

function parseField(src: string, min: number, max: number, names?: string[], offset = 0): Field | null {
  const set = new Set<number>()
  const val = (s: string): number => {
    const i = names?.indexOf(s.toUpperCase()) ?? -1
    return i >= 0 ? i + offset : Number(s)
  }
  for (const part of src.split(',')) {
    const m = /^(\*|[\w]+)(?:-([\w]+))?(?:\/(\d+))?$/.exec(part.trim())
    if (!m) return null
    const step = m[3] ? Number(m[3]) : 1
    let a: number
    let b: number
    if (m[1] === '*') {
      a = min
      b = max
    } else {
      a = val(m[1]!)
      b = m[2] ? val(m[2]) : m[3] ? max : a
    }
    if (![a, b, step].every(Number.isFinite) || step < 1 || a < min || b > max || a > b) return null
    for (let x = a; x <= b; x += step) set.add(x)
  }
  return { set, any: src.trim() === '*' }
}

export interface ParsedCron {
  minute: Field
  hour: Field
  dom: Field
  month: Field
  dow: Field
}

export function parseCron(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const minute = parseField(parts[0]!, 0, 59)
  const hour = parseField(parts[1]!, 0, 23)
  const dom = parseField(parts[2]!, 1, 31)
  const month = parseField(parts[3]!, 1, 12, MON, 1)
  const dow = parseField(parts[4]!, 0, 7, DOW)
  if (!minute || !hour || !dom || !month || !dow) return null
  if (dow.set.has(7)) dow.set.add(0)
  return { minute, hour, dom, month, dow }
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function wall(t: number, tz: string): WallClock {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    })
    fmtCache.set(tz, f)
  }
  const p: Record<string, string> = {}
  for (const x of f.formatToParts(t)) p[x.type] = x.value
  return {
    year: +p.year!,
    month: +p.month!,
    day: +p.day!,
    hour: +p.hour! % 24,
    minute: +p.minute!,
    weekday: DOW.indexOf(p.weekday!.slice(0, 3).toUpperCase()),
  }
}

function validTz(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

/** Next `count` run instants after `from`, evaluated on the wall clock of `tz`. */
export function nextRuns(expr: string, tz: string, count = 3, from: Date = new Date()): Date[] {
  const c = parseCron(expr)
  if (!c) return []
  const zone = validTz(tz)
  const MIN = 60_000
  const out: Date[] = []
  let t = Math.floor(from.getTime() / MIN) * MIN + MIN
  const dayOk = (w: WallClock) => {
    const d = c.dom.set.has(w.day)
    const wd = c.dow.set.has(w.weekday)
    // Standard cron: when both day fields are restricted, either one may match.
    if (!c.dom.any && !c.dow.any) return d || wd
    return d && wd
  }
  for (let guard = 0; guard < 200_000 && out.length < count; guard++) {
    const w = wall(t, zone)
    if (!c.month.set.has(w.month) || !dayOk(w)) {
      t += ((23 - w.hour) * 60 + (60 - w.minute)) * MIN
      continue
    }
    if (!c.hour.set.has(w.hour)) {
      t += (60 - w.minute) * MIN
      continue
    }
    if (!c.minute.set.has(w.minute)) {
      t += MIN
      continue
    }
    out.push(new Date(t))
    t += MIN
  }
  return out
}

export function formatRun(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: validTz(tz),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d)
}

export const CRON_PRESETS: { label: string; value: string }[] = [
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 02:00', value: '0 2 * * *' },
  { label: 'Weekdays at 08:00', value: '0 8 * * MON-FRI' },
  { label: 'Mondays at 08:00', value: '0 8 * * MON' },
  { label: 'First of the month', value: '0 0 1 * *' },
]

export const TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tashkent',
  'Asia/Tokyo',
  'Australia/Sydney',
]
