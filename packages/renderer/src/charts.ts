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

/** Keep the biggest `max - 1` categories and fold the rest into "Other" (no generated colours). */
export function foldOther(data: Datum[], max = 8): Datum[] {
  if (data.length <= max) return data
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const rest = sorted.slice(max - 1).reduce((a, d) => a + d.value, 0)
  return [...sorted.slice(0, max - 1), { label: 'Other', value: rest }]
}

export const SAMPLE_FUNNEL: Datum[] = [
  { label: 'Requested', value: 120 },
  { label: 'Scheduled', value: 96 },
  { label: 'In progress', value: 71 },
  { label: 'Done', value: 58 },
]

export interface Series {
  name: string
  values: number[]
}
export interface SeriesData {
  labels: string[]
  series: Series[]
}

export const SAMPLE_STACKED: SeriesData = {
  labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  series: [
    { name: 'Repair', values: [18, 22, 19, 27, 24, 30] },
    { name: 'Install', values: [12, 15, 14, 19, 17, 21] },
    { name: 'Inspect', values: [8, 9, 11, 10, 12, 14] },
  ],
}

/** Counts per `groupBy` value split by `seriesBy` value (stacked bars). */
export function groupCounts2(
  def: AppDefinition,
  source: string | undefined,
  groupBy: string | undefined,
  seriesBy: string | undefined,
  rows: RecordRow[] | undefined,
): SeriesData | null {
  const table = tableOf(def, source)
  if (!table || !groupBy || !seriesBy || !rows) return null
  const fg = fieldOf(table, groupBy)
  const fs = fieldOf(table, seriesBy)
  const labels: string[] = []
  const names: string[] = []
  const m = new Map<string, number>()
  for (const r of rows) {
    const g = formatCell(def, fg, r[groupBy]).text
    const s = formatCell(def, fs, r[seriesBy]).text
    if (!labels.includes(g)) labels.push(g)
    if (!names.includes(s)) names.push(s)
    m.set(`${g}\u0000${s}`, (m.get(`${g}\u0000${s}`) ?? 0) + 1)
  }
  return {
    labels,
    series: names.slice(0, 8).map((name) => ({
      name,
      values: labels.map((g) => m.get(`${g}\u0000${name}`) ?? 0),
    })),
  }
}

export interface Point {
  x: number
  y: number
  label?: string
}

export const SAMPLE_SCATTER: Point[] = [
  [1.2, 38],
  [2.5, 52],
  [3.1, 47],
  [3.8, 63],
  [4.4, 58],
  [5.0, 71],
  [5.6, 66],
  [6.3, 80],
  [7.1, 77],
  [2.0, 41],
  [4.9, 60],
  [6.8, 84],
].map(([x, y]) => ({ x: x!, y: y! }))

/** (x, y) pairs from two numeric fields; rows with non-numbers are skipped. */
export function numericPoints(rows: RecordRow[] | undefined, x?: string, y?: string): Point[] | null {
  if (!rows || !x || !y) return null
  const pts = rows
    .map((r) => ({ x: Number(r[x]), y: Number(r[y]), label: String(r.id ?? '') }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  return pts.length ? pts : null
}

/** Filled pie wedge from angle a0 to a1 (radians, 0 = 12 o'clock). */
export function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)].map((v) => v.toFixed(2)).join(' ')
  return `M ${cx} ${cy} L ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`
}
