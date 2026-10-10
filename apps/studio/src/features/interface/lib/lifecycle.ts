/** Page lifecycle helpers: counts, the read-only generated JS and new handlers. */
import {
  LIFECYCLE_PHASES,
  newId,
  type LifecycleHandler,
  type LogicFunction,
  type PageLifecycle,
} from '@platon/definition'

export const ALL_HOOKS = LIFECYCLE_PHASES.flatMap((p) => p.hooks)

export function handlerCount(lc: PageLifecycle | undefined): number {
  return Object.values(lc ?? {}).reduce((n, hs) => n + hs.length, 0)
}

export function newHandler(kind: LifecycleHandler['kind'], fn?: LogicFunction): LifecycleHandler {
  if (kind === 'code') return { id: newId('lc'), kind, code: '' }
  return {
    id: newId('lc'),
    kind,
    fn: fn?.name ?? '',
    args: Object.fromEntries((fn?.params ?? []).map((p) => [p.name, ''])),
  }
}

/** Re-map args when the chosen function changes, keeping values for params with the same name. */
export function withFunction(h: LifecycleHandler, fn: LogicFunction): LifecycleHandler {
  return {
    ...h,
    kind: 'function',
    fn: fn.name,
    args: Object.fromEntries(fn.params.map((p) => [p.name, h.args?.[p.name] ?? ''])),
  }
}

const indent = (s: string, n: number) =>
  s
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n')

/** What Studio writes into the page file for one hook (shown read-only in the inspector). */
export function generatedJs(hook: string, handlers: LifecycleHandler[]): string {
  const items = handlers.map((h) => {
    if (h.kind === 'function') {
      const args = Object.entries(h.args ?? {})
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `${k}: ${v.trim()}`)
        .join(', ')
      return `(ctx) => ctx.call('${h.fn ?? ''}', { ${args} }),`
    }
    return `async (ctx) => {\n${indent(h.code?.trim() || '// …', 2)}\n},`
  })
  return `${hook}: [\n${indent(items.join('\n'), 2)}\n],`
}
