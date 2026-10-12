import { describe, expect, it } from 'vitest'
import type { Block } from '@platon/definition'
import { rowGridClasses } from './grid'

const b = (id: string, span?: number): Block => ({
  id,
  type: 'text',
  ref: id,
  row: 0,
  props: {},
  ...(span ? { span } : {}),
})

describe('12-column row grid', () => {
  it('gives each block a column span and stacks them on narrow screens', () => {
    expect(rowGridClasses([b('a', 8), b('b')])).toEqual([
      'col-span-8 @max-[560px]:col-span-full',
      'col-span-4 @max-[560px]:col-span-full',
    ])
  })

  it('spans the full row for a lone block without a width', () => {
    expect(rowGridClasses([b('a')])).toEqual(['col-span-12 @max-[560px]:col-span-full'])
  })
})
