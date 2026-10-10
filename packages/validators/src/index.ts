import type { AppDefinition, Problem } from '@platon/definition'
import { validateLogic } from './logic'
import { validatePages } from './pages'
import { validateData } from './data'

export { validateLogic, splitArgs } from './logic'
export { validatePages, scriptProblems } from './pages'
export { validateData } from './data'

/** All client-side checks. The server's /validate is authoritative; this keeps the Problems panel instant. */
export function validateAll(def: AppDefinition): Problem[] {
  return [...validatePages(def), ...validateLogic(def), ...validateData(def)]
}

/** Problems whose path is inside `prefix` (e.g. one function or one page). */
export function problemsUnder(problems: Problem[], prefix: string): Problem[] {
  return problems.filter((p) => p.path === prefix || p.path.startsWith(prefix + '/'))
}

export function hasBlocking(problems: Problem[]): boolean {
  return problems.some((p) => p.severity === 'error')
}
