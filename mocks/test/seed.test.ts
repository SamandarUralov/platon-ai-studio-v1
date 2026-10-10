import { describe, expect, it } from 'vitest'
import { validateDefinition } from '@platon/definition/validate'
import { fieldopsDefinition } from '../src/seed/fieldops'

describe('FieldOps seed', () => {
  it('matches the app-definition JSON Schema', () => {
    const r = validateDefinition(fieldopsDefinition())
    if (!r.ok) console.error(r.issues.slice(0, 10))
    expect(r.ok).toBe(true)
  })

  it('gives every block on a page a unique ref', () => {
    for (const p of fieldopsDefinition().interface.pages) {
      const refs = p.blocks.map((b) => b.ref)
      expect(new Set(refs).size, p.id).toBe(refs.length)
    }
  })
})
