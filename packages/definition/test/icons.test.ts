import { describe, expect, it } from 'vitest'
import { icons } from 'lucide-vue-next'
import { BLOCKS, CHANGE_AREAS, ENGINES, FIELD_TYPES, LOGIC_KINDS, PAGE_ICONS, STEPS } from '../src'

const pascal = (n: string) => n.replace(/(^|[-_ ])(\w)/g, (_, __, c: string) => c.toUpperCase())

describe('catalog icons', () => {
  it('only uses icons that exist in lucide', () => {
    const names = [
      ...Object.values(BLOCKS).map((b) => b.icon),
      ...Object.values(STEPS).map((s) => s.icon),
      ...Object.values(LOGIC_KINDS).map((k) => k.icon),
      ...Object.values(ENGINES).map((e) => e.icon),
      ...Object.values(FIELD_TYPES).map((f) => f.icon),
      ...Object.values(CHANGE_AREAS).map((a) => a.icon),
      ...PAGE_ICONS,
    ]
    const missing = names.filter((n) => !(pascal(n) in icons))
    expect(missing).toEqual([])
  })
})
