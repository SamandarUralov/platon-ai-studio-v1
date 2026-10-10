/** Studio API contract — logic (requirements §6.1: test runs, runs, history, queue messages). */
import type { Api, Cron, EnvName, LogicFunction, StepType } from '../generated/app-definition'

/** One layer's result in a test-run trace. */
export interface TraceStep {
  stepId: string
  type: StepType
  status: 'ok' | 'fail' | 'skip'
  ms: number
  /** Short JSON/text of what the layer produced. */
  output?: string
  /** Variable the result was saved into. */
  into?: string
}

/**
 * Test a function / API / cron in Development. `item` carries the unsaved draft so people can
 * test before saving; without it the saved item is used.
 */
export interface LogicTestRequest {
  input: Record<string, string>
  item?: LogicFunction | Api | Cron
}

export interface LogicTestResponse {
  runId: string
  /** Run counter for this item (1, 2, …). */
  n: number
  ok: boolean
  /** HTTP code for REST, protocol code otherwise ("OK", "Fault"…); "ok"/"error" for functions. */
  status: string
  ms: number
  at: string
  output: unknown
  error?: { code: string; message: string; stepId?: string }
  trace: TraceStep[]
  ran: number
  total: number
  failIndex?: number
}

export interface LogicRun {
  id: string
  at: string
  env: EnvName
  status: string
  ok: boolean
  ms: number
}

export interface LogicHistoryEntry {
  id: string
  at: string
  who: string
  text: string
  /** False while the change is waiting for the next release. */
  released: boolean
}

export type QueueMessageStatus = 'waiting' | 'delivered' | 'retrying' | 'dead'

export interface QueueMessage {
  id: string
  at: string
  status: QueueMessageStatus
  attempts: number
  body: Record<string, unknown>
  error?: string
}

export interface SendQueueMessageRequest {
  body?: Record<string, unknown>
}

export interface FunctionStats {
  lastRunAt: string | null
  avgMs: number
  runs24h: number
  errors24h: number
}
export interface ApiStats {
  requests24h: number
  p95Ms: number
  failed24h: number
}
export interface CronStats {
  lastRunAt: string | null
  lastMs: number
  lastOk: boolean
}
export interface QueueStats {
  waiting: number
  processed24h: number
  dead: number
}

/** Runtime health shown as status dots and header badges. */
export interface LogicStatsResponse {
  functions: Record<string, FunctionStats>
  apis: Record<string, ApiStats>
  crons: Record<string, CronStats>
  queues: Record<string, QueueStats>
}
