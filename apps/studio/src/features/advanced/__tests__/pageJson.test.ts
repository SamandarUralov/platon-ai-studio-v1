/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fieldopsDefinition } from '@platon/mocks/seed'
import type { Page } from '@platon/definition'
import { checkPageJson, pageIdOf } from '../pageJson'

const def = fieldopsDefinition()
const settings = def.interface.pages.find((p) => p.id === 'app_settings')!
// The page from docs/meta (outside the Vite root, so read from disk), as someone would paste it.
const example = readFileSync(resolve(process.cwd(), '../docs/meta/settings-page.example.json'), 'utf8')
const keys = (r: ReturnType<typeof checkPageJson>) => (r.ok ? [] : r.issues.map((i) => i.key))
const withPage = (patch: (p: Page) => Page) => JSON.stringify(patch(structuredClone(settings)))

describe('page JSON edit', () => {
  it('reads the page id from a definition pointer', () => {
    expect(pageIdOf('/interface/pages/app_settings')).toBe('app_settings')
    expect(pageIdOf('/interface/pages/app_settings/blocks/as1')).toBeNull()
    expect(pageIdOf('/data/tables/work_orders')).toBeNull()
  })

  it('accepts the docs example for the Settings page', () => {
    const r = checkPageJson(example, def, 'app_settings')
    expect(keys(r)).toEqual([])
    expect(r.ok && r.page.blocks).toHaveLength(51)
  })

  it('reports broken JSON and a changed id', () => {
    expect(keys(checkPageJson('{ "id": ', def, 'app_settings'))).toEqual(['json'])
    expect(keys(checkPageJson('[]', def, 'app_settings'))).toEqual(['notObject'])
    expect(keys(checkPageJson(example, def, 'dashboard'))).toContain('idChanged')
  })

  it('reports schema errors with a page-relative path', () => {
    const r = checkPageJson(
      withPage((p) => ({ ...p, blocks: [{ ...p.blocks[0]!, type: 'nope' as never }] })),
      def,
      'app_settings',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues[0]).toMatchObject({ key: 'schema', params: { path: '/blocks/0/type' } })
  })

  it('reports layout and reference problems', () => {
    const r = checkPageJson(
      withPage((p) => ({
        ...p,
        route: '/dashboard',
        visibleTo: ['admin', 'ghost'],
        blocks: [
          ...p.blocks,
          { ...p.blocks[0]!, ref: 'other' },
          { id: 'x1', type: 'text', ref: 'pageHeader', row: 3, props: {} },
          { id: 'x2', type: 'text', ref: 'orphan', row: 0, parent: 'missing', props: {} },
          { id: 'x3', type: 'text', ref: 'inText', row: 0, parent: 'x1', props: {} },
          { id: 'g', type: 'grid', ref: 'grid', row: 4, props: { columns: 2, rows: 1 } },
          { id: 'x4', type: 'text', ref: 'far', row: 0, parent: 'g', slot: 5, props: {} },
          { id: 'c1', type: 'container', ref: 'loopA', row: 0, parent: 'c2', props: {} },
          { id: 'c2', type: 'container', ref: 'loopB', row: 0, parent: 'c1', props: {} },
          { id: 't', type: 'table', ref: 'tbl', row: 5, props: { source: 'nope' } },
          {
            id: 'f',
            type: 'form',
            ref: 'frm',
            row: 6,
            props: { source: 'customers', columns: ['name', 'zzz'] },
          },
        ],
      })),
      def,
      'app_settings',
    )
    expect([...new Set(keys(r))].sort()).toEqual(
      [
        'cycle',
        'dupId',
        'dupRef',
        'noField',
        'noParent',
        'noRole',
        'noTable',
        'notContainer',
        'routeTaken',
        'slot',
      ].sort(),
    )
  })
})
