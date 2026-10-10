/** Rough token accounting for the context ring (≈ 3.6 characters per token). */
import { getAt, type AiChip, type AiMessage, type AppDefinition } from '@platon/definition'

export const tok = (chars: number) => Math.ceil(chars / 3.6)

export function kfmt(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
}

/** Outline that's always sent: ids and names, not full trees. */
export function definitionOutlineTokens(def: AppDefinition | null): number {
  if (!def) return 0
  const outline = {
    pages: def.interface.pages.map((p) => [p.id, p.name, p.blocks.map((b) => [b.id, b.type])]),
    tables: def.data.tables.map((t) => [t.id, t.fields.map((f) => [f.key, f.type])]),
    functions: def.logic.functions.map((f) => [f.id, f.params.map((x) => x.name)]),
    apis: def.logic.apis.map((a) => a.id),
    roles: def.roles.map((r) => r.id),
    workflows: def.workflows.map((w) => [w.id, w.states.map((s) => s.id)]),
  }
  return tok(JSON.stringify(outline).length)
}

export function attachedTokens(def: AppDefinition | null, paths: string[]): number {
  if (!def) return 0
  return paths.reduce((a, p) => a + tok(JSON.stringify(getAt(def, p) ?? '').length), 0)
}

export function chatTokens(messages: AiMessage[], draft = ''): number {
  return (
    messages.reduce(
      (a, m) =>
        a +
        tok(m.text.length) +
        (m.plan ? m.plan.items.length * 380 : 0) +
        (m.diff ? m.diff.lines.length * 18 : 0) +
        140,
      0,
    ) + tok(draft.length)
  )
}

export const chipPaths = (chips: AiChip[]) =>
  chips.flatMap((c) => (c.kind === 'ctx' && c.context?.path ? [c.context.path] : []))
