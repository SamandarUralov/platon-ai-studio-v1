/** Value-type helpers for function signatures, API schemas and return checks (requirements §3.3). */
import type { TypedField } from './generated/app-definition'

export const isNested = (type: string): boolean => type === 'object' || type === 'array<object>'

export function formatFields(fields: TypedField[] | undefined): string {
  return `{ ${(fields ?? []).map((f) => `${f.name}${f.req ? '' : '?'}: ${formatType(f.type, f.fields)}`).join(', ')} }`
}

export function formatType(type: string, fields?: TypedField[]): string {
  if (type === 'object' && fields?.length) return formatFields(fields)
  if (type === 'array<object>' && fields?.length) return `array<${formatFields(fields)}>`
  return type
}

/**
 * Empty string when a value of type `a` can be used where `b` is expected; otherwise a reason.
 * `row<t>` fits `object`, `array<t>` fits `array<object>`.
 */
export function typeFits(
  a: string,
  aFields: TypedField[] | undefined,
  b: string,
  bFields: TypedField[] | undefined,
): string {
  if (a === 'any' || b === 'any') return ''
  const ok =
    a === b ||
    (b === 'object' && /^row</.test(a)) ||
    (b === 'array<object>' && /^array<(?!string|number|object)/.test(a)) ||
    (a === 'integer' && b === 'number')
  if (!ok) return `expected ${formatType(b, bFields)}, got ${formatType(a, aFields)}`
  if (isNested(b) && bFields?.length && aFields) {
    for (const f of bFields) {
      const src = aFields.find((x) => x.name === f.name)
      if (!src) {
        if (f.req) return `missing required field “${f.name}”`
        continue
      }
      const r = typeFits(src.type, src.fields, f.type, f.fields)
      if (r) return `${f.name}: ${r}`
    }
  }
  return ''
}

/** Example JSON value for a field list (API request/response previews). */
export function exampleOf(fields: TypedField[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields ?? []) out[f.name] = exampleValue(f)
  return out
}

export function exampleValue(f: TypedField): unknown {
  switch (f.type) {
    case 'string':
      return f.name.endsWith('id') ? 'WO-1042' : 'text'
    case 'number':
      return 12.5
    case 'integer':
      return 42
    case 'boolean':
      return true
    case 'date':
      return '2026-10-09'
    case 'datetime':
      return '2026-10-09T09:30:00Z'
    case 'enum':
      return f.values?.[0] ?? 'value'
    case 'object':
      return exampleOf(f.fields)
    case 'array<object>':
      return [exampleOf(f.fields)]
    case 'array<string>':
      return ['text']
    case 'array<number>':
      return [1, 2]
    case 'file':
      return 's3://field_files/photos/a81f.jpg'
    default:
      if (/^row</.test(f.type)) return { id: 'r_1' }
      if (/^array</.test(f.type)) return [{ id: 'r_1' }]
      return null
  }
}

export function pathParams(path: string): string[] {
  return (path.match(/:(\w+)/g) ?? []).map((x) => x.slice(1))
}
