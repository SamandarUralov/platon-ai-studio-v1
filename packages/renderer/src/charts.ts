/** Chart data: grouped counts from records when a source + groupBy is set, sample data otherwise. */
import type { AppDefinition } from '@platon/definition'
import type { RecordRow } from './context'
import { fieldOf, formatCell, tableOf } from './format'

export interface Datum {
  label: string
  value: number
}

export const SAMPLE_BAR: Datum[] = [
  { label: 'May', value: 42 },
  { label: 'Jun', value: 51 },
  { label: 'Jul', value: 47 },
  { label: 'Aug', value: 63 },
  { label: 'Sep', value: 58 },
  { label: 'Oct', value: 71 },
]
export const SAMPLE_LINE: Datum[] = [5.2, 4.8, 4.9, 4.1, 3.8, 3.9, 3.4, 3.1, 3.3, 2.9, 2.7, 2.6].map(
  (value, i) => ({
    label: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i]!,
    value,
  }),
)
export const SAMPLE_DONUT: Datum[] = [
  { label: 'Scheduled', value: 14 },
  { label: 'In progress', value: 9 },
  { label: 'Waiting on parts', value: 5 },
  { label: 'Done', value: 22 },
]

export function groupCounts(
  def: AppDefinition,
  source: string | undefined,
  groupBy: string | undefined,
  rows: RecordRow[] | undefined,
): Datum[] | null {
  const table = tableOf(def, source)
  if (!table || !groupBy || !rows) return null
  const f = fieldOf(table, groupBy)
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = formatCell(def, f, r[groupBy]).text
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m].map(([label, value]) => ({ label, value }))
}

/** Rounded max for axis ticks (e.g. 71 → 80). */
export function niceMax(n: number): number {
  if (n <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(n))
  return Math.ceil(n / p) * p
}

export function linePoints(data: Datum[], w: number, h: number, max: number): [number, number][] {
  const n = Math.max(1, data.length - 1)
  return data.map((d, i) => [(i / n) * w, h - (d.value / max) * h])
}

/** SVG arc path for a donut slice from angle a0 to a1 (radians, 0 = 12 o'clock). */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)].map((v) => v.toFixed(2)).join(' ')
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1 - 0.0001)}`
}
