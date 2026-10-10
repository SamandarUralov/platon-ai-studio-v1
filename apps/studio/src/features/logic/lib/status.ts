/** Health of a Logic item from validation problems and runtime stats (status dots, header badge). */
import type { Cron, LogicKind, LogicStatsResponse, Problem } from '@platon/definition'
import type { Tone } from '@platon/ui'
import type { LogicItem } from './nav'

export interface ItemStatus {
  tone: Tone
  /** i18n key under logic.status */
  key: 'healthy' | 'errors' | 'warnings' | 'attention' | 'paused'
  count?: number
}

export function itemStatus(
  kind: LogicKind,
  item: LogicItem,
  problems: Problem[],
  stats: LogicStatsResponse | undefined,
): ItemStatus {
  const errors = problems.filter((p) => p.severity === 'error').length
  if (errors) return { tone: 'danger', key: 'errors', count: errors }
  if (kind === 'crons' && !(item as Cron).enabled) return { tone: 'neutral', key: 'paused' }
  const warnings = problems.filter((p) => p.severity === 'warning').length
  const id = item.id
  const runtimeBad =
    (kind === 'functions' && (stats?.functions[id]?.errors24h ?? 0) > 0) ||
    (kind === 'apis' && (stats?.apis[id]?.failed24h ?? 0) > 0) ||
    (kind === 'queues' && (stats?.queues[id]?.dead ?? 0) > 0) ||
    (kind === 'crons' && stats?.crons[id]?.lastOk === false)
  if (runtimeBad) return { tone: 'warn', key: 'attention' }
  if (warnings) return { tone: 'warn', key: 'warnings', count: warnings }
  return { tone: 'ok', key: 'healthy' }
}

/** First error per step id under an item, for layer badges. */
export function problemsByStep(problems: Problem[], itemPath: string): Map<string, string> {
  const prefix = `${itemPath}/steps/`
  const m = new Map<string, string>()
  for (const p of problems) {
    if (!p.path.startsWith(prefix)) continue
    const id = p.path.slice(prefix.length).split('/')[0]!
    if (p.severity === 'error' || !m.has(id)) m.set(id, p.message)
  }
  return m
}
