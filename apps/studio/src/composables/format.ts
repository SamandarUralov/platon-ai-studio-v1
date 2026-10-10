import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { ProjectSummary } from '@platon/definition'

dayjs.extend(relativeTime)

export function relTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = dayjs(iso)
  const mins = dayjs().diff(d, 'minute')
  if (mins < 1) return 'just now'
  if (mins < 60 * 24 * 6) return d.fromNow()
  return d.format('MMM D')
}

export function fmtDate(iso: string | null | undefined, f = 'MMM D, HH:mm'): string {
  return iso ? dayjs(iso).format(f) : '—'
}

export function statusLabel(p: Pick<ProjectSummary, 'status' | 'liveRelease'>): string {
  if (p.status === 'production') return p.liveRelease ? `Live · ${p.liveRelease}` : 'Live'
  return p.status[0]!.toUpperCase() + p.status.slice(1)
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < u.length - 1)
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
