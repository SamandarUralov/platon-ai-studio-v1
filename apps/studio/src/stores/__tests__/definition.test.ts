import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getAt } from '@platon/definition'
import { createMockServer, http, HttpResponse, resetMockDb, db } from '@platon/mocks/node'
import { useDefinitionStore } from '../definition'
import { useDraftsStore } from '../drafts'

const server = createMockServer()
const flush = () => new Promise((r) => setTimeout(r, 30))
async function settle(store: ReturnType<typeof useDefinitionStore>) {
  for (let i = 0; i < 50 && store.sync === 'saving'; i++) await flush()
}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())
beforeEach(() => {
  resetMockDb()
  setActivePinia(createPinia())
})

const TITLE = '/interface/pages/orders/blocks/o3/title'

describe('definition store', () => {
  it('loads the definition and pending changes', async () => {
    const s = useDefinitionStore()
    await s.load('fieldops')
    expect(s.definition?.name).toBe('FieldOps Service Desk')
    expect(s.changes.length).toBe(2)
  })

  it('applies optimistically, syncs to the server and records the change', async () => {
    const s = useDefinitionStore()
    await s.load('fieldops')
    const v = s.serverVersion
    s.apply({
      key: 'interface.pages.orders.blocks.o3.title',
      area: 'Pages',
      text: 'Renamed table',
      ops: [{ op: 'replace', path: TITLE, value: 'Jobs' }],
    })
    expect(s.get(TITLE)).toBe('Jobs')
    await settle(s)
    expect(s.sync).toBe('saved')
    expect(s.serverVersion).toBe(v + 1)
    expect(getAt(db.state.fieldops!.definition, TITLE)).toBe('Jobs')
    expect(s.changes.some((c) => c.key === 'interface.pages.orders.blocks.o3.title')).toBe(true)
  })

  it('undoes and redoes through new changes', async () => {
    const s = useDefinitionStore()
    await s.load('fieldops')
    s.apply({ key: 'k', area: 'Pages', text: 't', ops: [{ op: 'replace', path: TITLE, value: 'Jobs' }] })
    s.undo()
    expect(s.get(TITLE)).toBe('All work orders')
    s.redo()
    expect(s.get(TITLE)).toBe('Jobs')
    await settle(s)
    expect(getAt(db.state.fieldops!.definition, TITLE)).toBe('Jobs')
  })

  it('rebases unsent edits after a 409 conflict', async () => {
    const s = useDefinitionStore()
    await s.load('fieldops')
    // Someone else edits on the server meanwhile.
    const other = db.state.fieldops!
    other.definition = {
      ...other.definition,
      version: other.definition.version + 1,
      name: 'Renamed elsewhere',
    }
    s.apply({ key: 'k', area: 'Pages', text: 't', ops: [{ op: 'replace', path: TITLE, value: 'Jobs' }] })
    await settle(s)
    expect(s.sync).toBe('saved')
    expect(s.definition?.name).toBe('Renamed elsewhere')
    expect(s.get(TITLE)).toBe('Jobs')
  })

  it('rolls back the local view when the server rejects an edit', async () => {
    server.use(
      http.post('/api/v1/projects/:id/changes', () =>
        HttpResponse.json({ error: 'invalid_patch', message: 'nope' }, { status: 422 }),
      ),
    )
    const s = useDefinitionStore()
    await s.load('fieldops')
    s.apply({ key: 'k', area: 'Pages', text: 't', ops: [{ op: 'replace', path: TITLE, value: 'Jobs' }] })
    await settle(s)
    expect(s.sync).toBe('error')
    expect(s.get(TITLE)).toBe('All work orders')
  })

  it('refuses edits whose target does not exist', async () => {
    const s = useDefinitionStore()
    await s.load('fieldops')
    expect(
      s.apply({ key: 'k', area: 'Pages', text: 't', ops: [{ op: 'remove', path: '/interface/pages/nope' }] }),
    ).toBe(false)
  })
})

describe('drafts store', () => {
  it('keeps edits local until save, then writes one change', async () => {
    const s = useDefinitionStore()
    await s.load('fieldops')
    const d = useDraftsStore()
    const path = '/logic/functions/calc_sla_due'
    d.edit<{ timeout: string }>(path, (fn) => ({ ...fn, timeout: '20 s' }))
    expect(d.isDirty(path)).toBe(true)
    expect(s.get<{ timeout: string }>(path)?.timeout).toBe('10 s')
    expect(d.value<{ timeout: string }>(path)?.timeout).toBe('20 s')
    d.save(path, { key: 'logic.functions.calc_sla_due', area: 'Logic', text: 'Changed timeout' })
    expect(d.isDirty(path)).toBe(false)
    expect(s.get<{ timeout: string }>(path)?.timeout).toBe('20 s')
  })

  it('drops the draft when edits return to the original', async () => {
    const s = useDefinitionStore()
    await s.load('fieldops')
    const d = useDraftsStore()
    const path = '/logic/functions/calc_sla_due'
    d.edit<{ timeout: string }>(path, (fn) => ({ ...fn, timeout: '20 s' }))
    d.edit<{ timeout: string }>(path, (fn) => ({ ...fn, timeout: '10 s' }))
    expect(d.isDirty(path)).toBe(false)
  })
})
