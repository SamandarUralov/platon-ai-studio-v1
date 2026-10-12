import { describe, expect, it } from 'vitest'
import type { Block, Page } from '@platon/definition'
import { fieldopsDefinition } from '../../../../../../mocks/src/seed'
import { definitionEvent, overridePatches, withOverrides } from '../overrides'
import { toSandboxMeta } from '../meta'

const blk = (id: string, type: Block['type'], row: number, extra: Partial<Block> = {}): Block => ({
  id,
  type,
  ref: id,
  row,
  props: {},
  ...extra,
})
const page: Page = {
  id: 'lab',
  name: 'Lab',
  icon: 'flask',
  route: '/lab',
  inMenu: true,
  blocks: [
    blk('save', 'button', 0, { props: { label: 'Save', variant: 'primary' } }),
    blk('note', 'text', 1, { props: { text: 'Hi' } }),
    blk('jobs', 'table', 2, { title: 'Jobs', props: { source: 'work_orders' } }),
  ],
}
const def = (() => {
  const d = fieldopsDefinition()
  return { ...d, interface: { ...d.interface, pages: [...d.interface.pages, page] } }
})()

describe('page script effects in the Sandbox', () => {
  it('maps Sandbox component events to definition events', () => {
    expect(definitionEvent('button', 'click')).toBe('click')
    expect(definitionEvent('header', 'action')).toBe('buttonClick')
    expect(definitionEvent('table', 'row-click')).toBe('rowClick')
    expect(definitionEvent('input', 'change')).toBe('change')
    // Not a definition event of that block: no handler can listen to it.
    expect(definitionEvent('input', 'update:modelValue')).toBeNull()
    expect(definitionEvent('text', 'click')).toBeNull()
  })

  it('applies runtime overrides to the page', () => {
    const p = withOverrides(page, {
      save: { disabled: true, label: 'Saving…' },
      note: { visible: false },
      jobs: { title: 'Open jobs', rows: [{ id: 'r1' }], loading: false },
    })
    expect(p.blocks[0]!.props).toEqual({ label: 'Saving…', variant: 'primary', disabled: true })
    expect(p.blocks[1]!.visibility).toEqual({ roles: [] })
    expect(p.blocks[1]!.props).toEqual({ text: 'Hi' })
    expect(p.blocks[2]).toMatchObject({ title: 'Open jobs', props: { rows: [{ id: 'r1' }] } })
    expect(withOverrides(page, {})).toBe(page)
  })

  it('patches only the overridden blocks, with their Sandbox props', () => {
    const patches = overridePatches(def, page, { save: { disabled: true }, note: { visible: false } })
    expect(patches).toEqual([
      { blockId: 'save', path: 'props', value: { label: 'Save', variant: 'primary', disabled: true } },
      { blockId: 'save', path: 'visible_to', value: undefined },
      { blockId: 'note', path: 'props', value: { text: 'Hi' } },
      { blockId: 'note', path: 'visible_to', value: ['~nobody'] },
    ])
    // Shown again: the patch clears the hiding.
    const back = overridePatches(def, page, { note: { visible: true } })
    expect(back).toContainEqual({ blockId: 'note', path: 'visible_to', value: undefined })
  })

  it('passes rows a script loaded to the table', () => {
    const [props] = overridePatches(def, page, { jobs: { rows: [{ id: 'r1' }] } })
    expect(props).toMatchObject({ blockId: 'jobs', path: 'props', value: { rows: [{ id: 'r1' }] } })
  })

  it('can leave the lifecycle to the Studio', () => {
    const withHooks = {
      ...def,
      interface: {
        ...def.interface,
        pages: [
          { ...page, lifecycle: { onPageReady: [{ id: 'h', kind: 'code' as const, code: 'ctx.log(1)' }] } },
        ],
      },
    }
    expect(toSandboxMeta(withHooks).meta.pages[0]!.lifecycle).toBeDefined()
    expect(toSandboxMeta(withHooks, { lifecycle: false }).meta.pages[0]!.lifecycle).toBeUndefined()
  })
})
