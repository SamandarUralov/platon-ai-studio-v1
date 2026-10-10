import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateProjectRequest, ProjectSummary } from '@platon/definition'
import { BUILD_TASKS, createNewProjectFlow, TIMING, type FlowDeps } from './flow'
import { QUESTIONS } from './catalog'

const ME = { id: 'u_me', name: 'Maya Chen', email: 'maya@acme.test' }
const SUMMARY = { id: 'fieldops_2', name: 'FieldOps' } as ProjectSummary

function setup(over: Partial<FlowDeps> = {}) {
  const create = vi.fn<(r: CreateProjectRequest) => Promise<ProjectSummary>>().mockResolvedValue(SUMMARY)
  const flow = createNewProjectFlow({
    me: () => ME,
    create,
    initialInput: 'An app for field technicians to manage work orders.',
    ...over,
  })
  return { flow, create: (over.create as typeof create | undefined) ?? create }
}

/** Drive intro → brief → first question. */
function toQuestions(flow: ReturnType<typeof setup>['flow']) {
  flow.start()
  vi.advanceTimersByTime(TIMING.noFiles)
  flow.continueBrief()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('new project flow', () => {
  it('reads attached files one by one, then shows the brief', () => {
    const { flow } = setup()
    flow.addFiles([
      { name: 'spec.docx', size: 1000 },
      { name: 'process.pdf', size: 2000 },
    ])
    expect(flow.state.staged.map((f) => f.badge)).toEqual(['DOC', 'PDF'])
    flow.start()
    expect(flow.state.phase).toBe('reading')
    expect(flow.state.msgs[0]).toMatchObject({
      kind: 'user',
      files: [{ name: 'spec.docx' }, { name: 'process.pdf' }],
    })

    vi.advanceTimersByTime(TIMING.firstFile)
    const analysis = flow.state.msgs.find((m) => m.kind === 'analysis')
    expect(analysis?.kind === 'analysis' && analysis.files.map((f) => f.status)).toEqual(['done', 'parsing'])

    vi.advanceTimersByTime(TIMING.perFile * 2 + TIMING.summarise)
    expect(flow.state.phase).toBe('brief')
    expect(flow.state.name).toBe('FieldOps')
    expect(flow.inScope.value).toBe(flow.state.reqs.length)
  })

  it('does not start without a prompt or files', () => {
    const { flow } = setup({ initialInput: '  ' })
    flow.start()
    expect(flow.state.phase).toBe('intro')
  })

  it('toggles and adds requirements', () => {
    const { flow } = setup()
    flow.start()
    vi.advanceTimersByTime(TIMING.noFiles)
    const total = flow.state.reqs.length
    flow.toggleRequirement(flow.state.reqs[0]!.id)
    flow.addRequirement('Works offline')
    expect(flow.state.reqs.length).toBe(total + 1)
    expect(flow.inScope.value).toBe(total)
  })

  it('walks the six questions with defaults and lands on the summary', () => {
    const { flow } = setup()
    toQuestions(flow)
    expect(flow.state.phase).toBe('q')
    expect(flow.question.value.id).toBe('signin')
    for (let i = 0; i < QUESTIONS.length; i++) flow.next()
    expect(flow.state.phase).toBe('summary')
    expect(flow.answeredCount.value).toBe(6)
    // The current user is on the team as a locked owner.
    expect(flow.state.answers.team?.sel.v).toEqual([ME.id])
  })

  it('validates multi-select questions and accepts a free-text answer instead', () => {
    const { flow } = setup()
    toQuestions(flow)
    for (const id of ['password', 'eimzo', 'oneid']) flow.pick('v', id)
    expect(flow.valid.value).toBe(false)
    flow.state.custom = 'Whatever the bank uses'
    expect(flow.valid.value).toBe(true)
    flow.next()
    expect(flow.state.answers.signin).toMatchObject({ text: 'Whatever the bank uses' })
    expect(flow.state.ack).toEqual({ kind: 'text' })
  })

  it('picks by digit only on plain chip/list questions', () => {
    const { flow } = setup()
    toQuestions(flow)
    expect(flow.pickByIndex(3)).toBe(true) // LDAP
    expect(flow.state.sel.v).toContain('ldap')
    flow.next()
    flow.next() // → theme (swatches): digits do nothing
    expect(flow.question.value.id).toBe('theme')
    expect(flow.pickByIndex(1)).toBe(false)
  })

  it('skip stores defaults marked as skipped; back returns to the brief from Q1', () => {
    const { flow } = setup()
    toQuestions(flow)
    flow.skip()
    expect(flow.state.answers.signin).toMatchObject({
      skipped: true,
      sel: { v: ['password', 'eimzo', 'oneid'] },
    })
    expect(flow.state.ack).toEqual({ kind: 'skipped' })
    flow.back()
    expect(flow.question.value.id).toBe('signin')
    flow.back()
    expect(flow.state.phase).toBe('brief')
  })

  it('editing a fully answered set saves straight back to the summary', () => {
    const { flow } = setup()
    toQuestions(flow)
    for (let i = 0; i < QUESTIONS.length; i++) flow.next()
    flow.edit('theme')
    expect(flow.state.editing).toBe(true)
    flow.pick('color', 'ember')
    expect(flow.theme.value.hex).toBe('#d9541e') // preview follows the unsaved pick
    flow.next()
    expect(flow.state.phase).toBe('summary')
    expect(flow.state.answers.theme?.sel.color).toBe('ember')
  })

  it('manages team members and roles; the owner cannot be removed', () => {
    const { flow } = setup()
    toQuestions(flow)
    for (let i = 0; i < 4; i++) flow.next()
    expect(flow.question.value.id).toBe('team')
    flow.addMember({ id: 'u_1', name: 'Aziz Rahimov', email: 'aziz@acme.test' })
    flow.setRole('u_1', 'maintainer')
    flow.removeMember(ME.id)
    flow.setRole(ME.id, 'guest')
    expect(flow.teamIds.value).toEqual([ME.id, 'u_1'])
    flow.next()
    flow.next()
    expect(flow.request().team).toEqual([
      { userId: ME.id, role: 'owner' },
      { userId: 'u_1', role: 'maintainer' },
    ])
  })

  it('builds the request and only finishes once the server responded', async () => {
    let resolve!: (p: ProjectSummary) => void
    const create = vi.fn((_req: CreateProjectRequest) => new Promise<ProjectSummary>((r) => (resolve = r)))
    const { flow } = setup({ create })
    toQuestions(flow)
    for (let i = 0; i < QUESTIONS.length; i++) flow.next()
    flow.create()
    expect(flow.state.phase).toBe('building')
    const req = create.mock.calls[0]![0]
    expect(req).toMatchObject({
      name: 'FieldOps',
      signIn: ['password', 'eimzo', 'oneid'],
      theme: { color: '#4f5bea', mode: 'light', radius: 'soft' },
      languages: ['en', 'uz', 'ru'],
      data: { engine: 'postgres', storage: 'new', sample: true },
    })

    vi.advanceTimersByTime(TIMING.buildTick * (BUILD_TASKS.length + 3))
    expect(flow.state.phase).toBe('building')
    expect(flow.state.gen).toBe(BUILD_TASKS.length - 1)

    resolve(SUMMARY)
    await vi.advanceTimersByTimeAsync(TIMING.buildTick)
    expect(flow.state.phase).toBe('done')
    expect(flow.state.result?.id).toBe('fieldops_2')
  })

  it('shows an error and retries a failed create', async () => {
    const create = vi
      .fn<(r: CreateProjectRequest) => Promise<ProjectSummary>>()
      .mockRejectedValueOnce(new Error('Give the app a name'))
      .mockResolvedValue(SUMMARY)
    const { flow } = setup({ create })
    toQuestions(flow)
    for (let i = 0; i < QUESTIONS.length; i++) flow.next()
    flow.create()
    await vi.advanceTimersByTimeAsync(TIMING.buildTick)
    expect(flow.state.buildError).toBe('Give the app a name')
    const gen = flow.state.gen
    await vi.advanceTimersByTimeAsync(TIMING.buildTick * 3)
    expect(flow.state.gen).toBe(gen) // ticker stopped

    flow.retry()
    expect(flow.state.buildError).toBeNull()
    await vi.advanceTimersByTimeAsync(TIMING.buildTick * (BUILD_TASKS.length + 1))
    expect(flow.state.phase).toBe('done')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('restart drops pending timers and resets state', () => {
    const { flow } = setup()
    flow.start()
    flow.restart()
    vi.advanceTimersByTime(5000)
    expect(flow.state.phase).toBe('intro')
    expect(flow.state.msgs).toEqual([])
    expect(flow.state.input).toContain('field technicians')
  })
})
