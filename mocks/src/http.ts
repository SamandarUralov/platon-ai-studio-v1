/** Helpers shared by all mock handlers. */
import { delay, HttpResponse } from 'msw'
import { API_BASE, type ApiErrorBody } from '@platon/definition'
import { project, type ProjectState } from './db'

export const api = (path: string) => `${API_BASE}${path}`

/** Realistic latency so loading states are visible; skipped in tests. */
export async function latency(ms = 180): Promise<void> {
  if (import.meta.env?.MODE === 'test') return
  await delay(ms + Math.round(Math.random() * ms * 0.6))
}

export function fail(
  status: number,
  error: string,
  message: string,
  details?: ApiErrorBody['details'],
): Response {
  const b: ApiErrorBody = { error, message, ...(details ? { details } : {}) }
  return HttpResponse.json(b, { status })
}

export function withProject<T>(
  id: string | readonly string[] | undefined,
  fn: (p: ProjectState, id: string) => T,
) {
  const pid = String(id)
  const p = project(pid)
  if (!p) return fail(404, 'not_found', `Project ${pid} not found`)
  return fn(p, pid)
}

/** Split Google-style action suffixes: "calc_sla_due:save" → ["calc_sla_due", "save"]. */
export function action(param: string | readonly string[] | undefined): [string, string | null] {
  const s = String(param ?? '')
  const i = s.lastIndexOf(':')
  return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)]
}

export async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    return {} as T
  }
}

/** Typed JSON response that stays compatible with `fail()` in the same resolver. */
export function json<T>(data: T, init?: ResponseInit): Response {
  return HttpResponse.json(data as never, init)
}
