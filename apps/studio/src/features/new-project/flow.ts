/**
 * New Project state machine: intro → reading → brief → q → summary → building → done.
 * Framework-light (only Vue reactivity) so it can be unit-tested with fake timers; components
 * get it through `provideFlow` / `useFlow`.
 */
import { computed, inject, provide, reactive, type InjectionKey } from 'vue'
import type { CreateProjectRequest, ProjectSummary } from '@platon/definition'
import { analyze, findingFor, type Brief } from './analysis'
import {
  brandHex,
  DEFAULT_ROLE,
  fileKind,
  QUESTIONS,
  questionById,
  type FileKind,
  type ProjectRole,
  type QuestionDef,
  type QuestionId,
  type Selection,
} from './catalog'

export type Phase = 'intro' | 'reading' | 'brief' | 'q' | 'summary' | 'building' | 'done'

export interface Person {
  id: string
  name: string
  email: string
}

export interface StagedFile {
  id: number
  name: string
  size: number
  kind: FileKind
  badge: string
}

export interface AnalysedFile extends StagedFile {
  status: 'parsing' | 'done'
  finding: string
}

export type Msg =
  | { kind: 'user'; text: string; files: StagedFile[] }
  | { kind: 'analysis'; files: AnalysedFile[] }
  | { kind: 'brief' }
  | { kind: 'intro' }

export interface Answer {
  sel: Selection
  roles: Record<string, ProjectRole>
  /** Free-text answer ("Or answer in your own words…"); structured fields then use defaults. */
  text?: string
  skipped?: boolean
}

export type Ack = { kind: 'skipped' } | { kind: 'text' } | { kind: 'answer'; q: QuestionId; answer: Answer }

export interface Requirement {
  id: number
  text: string
  on: boolean
}

export const TIMING = {
  analysisDelay: 300,
  firstFile: 900,
  perFile: 650,
  summarise: 700,
  noFiles: 900,
  buildTick: 550,
}

export const BUILD_TASKS = [
  'requirements',
  'model',
  'pages',
  'roles',
  'signin',
  'modules',
  'theme',
  'langs',
  'data',
  'invite',
] as const
export type BuildTask = (typeof BUILD_TASKS)[number]

const STAGE_OF: Record<Phase, number> = {
  intro: 0,
  reading: 0,
  brief: 0,
  q: 1,
  summary: 2,
  building: 3,
  done: 3,
}

export interface FlowDeps {
  /** Current user; always on the team as a locked Owner. */
  me: () => Person | null
  create: (req: CreateProjectRequest) => Promise<ProjectSummary>
  initialInput?: string
  timing?: Partial<typeof TIMING>
}

// Selections are plain JSON; structuredClone can't copy Vue proxies.
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function initial(input: string) {
  return {
    phase: 'intro' as Phase,
    input,
    staged: [] as StagedFile[],
    msgs: [] as Msg[],
    brief: null as Brief | null,
    name: '',
    reqs: [] as Requirement[],
    newReq: '',
    answers: {} as Partial<Record<QuestionId, Answer>>,
    qi: 0,
    sel: {} as Selection,
    roles: {} as Record<string, ProjectRole>,
    custom: '',
    editing: false,
    ack: null as Ack | null,
    thinking: false,
    gen: 0,
    result: null as ProjectSummary | null,
    buildError: null as string | null,
    /** Everyone ever added to the team, so names survive after the directory query changes. */
    people: {} as Record<string, Person>,
  }
}

export type FlowState = ReturnType<typeof initial>

export function createNewProjectFlow(deps: FlowDeps) {
  const T = { ...TIMING, ...deps.timing }
  const state = reactive(initial(deps.initialInput ?? ''))
  let timers: ReturnType<typeof setTimeout>[] = []
  let ticker: ReturnType<typeof setInterval> | null = null
  // Bumped on restart so late timers / responses from an abandoned run are ignored.
  let run = 0
  let fileSeq = 0
  let reqSeq = 0

  const later = (fn: () => void, ms: number) => {
    const r = run
    timers.push(setTimeout(() => r === run && fn(), ms))
  }
  function stopTicker() {
    if (ticker) clearInterval(ticker)
    ticker = null
  }
  function dispose() {
    timers.forEach(clearTimeout)
    timers = []
    stopTicker()
  }

  const question = computed<QuestionDef>(() => QUESTIONS[state.qi]!)
  const locked = computed(() => state.phase === 'building' || state.phase === 'done')
  const stageIndex = computed(() => STAGE_OF[state.phase])
  const answeredCount = computed(() => QUESTIONS.filter((q) => state.answers[q.id]).length)
  const inScope = computed(() => state.reqs.filter((r) => r.on).length)
  const meId = () => deps.me()?.id

  function defaults(q: QuestionDef): Answer {
    if (q.id === 'team') {
      const me = deps.me()
      return { sel: { v: me ? [me.id] : [] }, roles: me ? { [me.id]: 'owner' } : {} }
    }
    return { sel: clone(q.defaults), roles: {} }
  }

  function person(id: string): Person | null {
    const me = deps.me()
    return me?.id === id ? me : (state.people[id] ?? null)
  }

  /** The answer used for summary/build: what the user chose, or the default. */
  function value(id: QuestionId): Answer {
    const a = state.answers[id]
    return a && !a.text ? a : defaults(questionById(id))
  }

  /** Theme shown in the live preview — tracks unsaved picks while the theme question is open. */
  const theme = computed(() => {
    const sel =
      state.phase === 'q' && question.value.id === 'theme' && !state.custom.trim()
        ? state.sel
        : value('theme').sel
    return {
      color: String(sel.color),
      hex: brandHex(String(sel.color)),
      mode: String(sel.mode),
      radius: String(sel.radius),
    }
  })

  const valid = computed(() => {
    if (state.phase !== 'q') return false
    if (state.custom.trim()) return true
    return question.value.groups.every((g) => {
      const v = state.sel[g.key]
      if (g.kind === 'member') return true
      return g.multi ? Array.isArray(v) && v.length > 0 : !!v
    })
  })

  // ── intro / reading / brief ──────────────────────────────────────────────

  function addFiles(files: ArrayLike<{ name: string; size: number }>) {
    for (const f of Array.from(files))
      state.staged.push({ id: ++fileSeq, name: f.name, size: f.size, ...fileKind(f.name) })
  }
  function removeFile(id: number) {
    state.staged = state.staged.filter((f) => f.id !== id)
  }
  const canStart = computed(() => !!state.input.trim() || state.staged.length > 0)

  function start() {
    if (state.phase !== 'intro' || !canStart.value) return
    const text = state.input.trim()
    const files = state.staged
    state.brief = analyze(text)
    state.name = state.brief.name
    state.reqs = state.brief.requirements.map((t) => ({ id: ++reqSeq, text: t, on: true }))
    state.phase = 'reading'
    state.msgs = [{ kind: 'user', text, files }]
    state.input = ''
    state.staged = []
    if (!files.length) {
      state.thinking = true
      later(toBrief, T.noFiles)
      return
    }
    later(
      () =>
        state.msgs.push({
          kind: 'analysis',
          files: files.map((f, i) => ({ ...f, status: 'parsing', finding: findingFor(i) })),
        }),
      T.analysisDelay,
    )
    files.forEach((_, i) =>
      later(
        () => {
          const m = state.msgs.find((x) => x.kind === 'analysis')
          if (m?.kind === 'analysis') m.files[i]!.status = 'done'
        },
        T.firstFile + i * T.perFile,
      ),
    )
    const after = T.firstFile + files.length * T.perFile
    later(() => (state.thinking = true), after)
    later(toBrief, after + T.summarise)
  }

  function toBrief() {
    state.thinking = false
    state.phase = 'brief'
    state.msgs.push({ kind: 'brief' })
  }

  function toggleRequirement(id: number) {
    if (locked.value) return
    const r = state.reqs.find((x) => x.id === id)
    if (r) r.on = !r.on
  }
  function addRequirement(text = state.newReq) {
    const t = text.trim()
    if (!t || locked.value) return
    state.reqs.push({ id: ++reqSeq, text: t, on: true })
    state.newReq = ''
  }

  function continueBrief() {
    if (state.phase !== 'brief') return
    if (!state.msgs.some((m) => m.kind === 'intro')) state.msgs.push({ kind: 'intro' })
    loadQ(0, { ack: null })
  }

  // ── questions ────────────────────────────────────────────────────────────

  function loadQ(i: number, extra: { ack?: Ack | null; editing?: boolean } = {}) {
    const q = QUESTIONS[i]!
    const a = state.answers[q.id]
    const base = a && !a.text && !a.skipped ? a : defaults(q)
    state.phase = 'q'
    state.qi = i
    state.sel = clone(base.sel)
    state.roles = clone(base.roles)
    state.custom = a?.text ?? ''
    if ('ack' in extra) state.ack = extra.ack ?? null
    if (extra.editing !== undefined) state.editing = extra.editing
  }

  function advance(answers: Partial<Record<QuestionId, Answer>>, ack: Ack) {
    const ni = state.editing
      ? QUESTIONS.findIndex((x) => !answers[x.id])
      : state.qi + 1 < QUESTIONS.length
        ? state.qi + 1
        : -1
    state.answers = answers
    if (ni < 0) {
      state.phase = 'summary'
      state.editing = false
      state.ack = null
      return
    }
    loadQ(ni, { ack })
  }

  function next() {
    if (!valid.value) return
    const q = question.value
    const text = state.custom.trim()
    const answer: Answer = text
      ? { sel: {}, roles: {}, text }
      : { sel: clone(state.sel), roles: clone(state.roles) }
    advance(
      { ...state.answers, [q.id]: answer },
      text ? { kind: 'text' } : { kind: 'answer', q: q.id, answer },
    )
  }

  function skip() {
    if (state.phase !== 'q') return
    const q = question.value
    advance({ ...state.answers, [q.id]: { ...defaults(q), skipped: true } }, { kind: 'skipped' })
  }

  function back() {
    if (state.phase === 'summary') return loadQ(QUESTIONS.length - 1, { ack: null })
    if (state.phase !== 'q') return
    if (state.qi === 0) {
      state.phase = 'brief'
      state.ack = null
      return
    }
    loadQ(state.qi - 1, { ack: null })
  }

  function edit(id: QuestionId) {
    if (locked.value || state.phase === 'intro' || state.phase === 'reading') return
    const i = QUESTIONS.findIndex((q) => q.id === id)
    if (i < 0) return
    // Only a fully answered set jumps back to the next gap / summary on Save.
    loadQ(i, { ack: null, editing: QUESTIONS.every((q) => state.answers[q.id]) })
  }

  function pick(groupKey: string, optionId: string) {
    if (state.phase !== 'q') return
    const g = question.value.groups.find((x) => x.key === groupKey)
    if (!g) return
    if (g.multi) {
      const cur = Array.isArray(state.sel[g.key]) ? (state.sel[g.key] as string[]) : []
      state.sel[g.key] = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId]
    } else state.sel[g.key] = optionId
    state.custom = ''
  }

  /** 1–9 keys pick from the first group when it is a plain chips/list group. */
  function pickByIndex(n: number): boolean {
    if (state.phase !== 'q') return false
    const g = question.value.groups[0]!
    if (g.kind !== 'chips' && g.kind !== 'list') return false
    const o = g.options[n - 1]
    if (!o) return false
    pick(g.key, o.id)
    return true
  }

  const teamIds = computed(() =>
    Array.isArray(state.sel.v) && question.value.id === 'team' ? (state.sel.v as string[]) : [],
  )

  function addMember(p: Person) {
    if (question.value.id !== 'team' || teamIds.value.includes(p.id)) return
    state.people[p.id] = p
    state.sel.v = [...teamIds.value, p.id]
    state.roles[p.id] ??= DEFAULT_ROLE
    state.custom = ''
  }
  function removeMember(id: string) {
    if (id === meId()) return
    state.sel.v = teamIds.value.filter((x) => x !== id)
    delete state.roles[id]
  }
  function setRole(id: string, role: ProjectRole) {
    if (id === meId()) return
    state.roles[id] = role
  }

  // ── summary / building ───────────────────────────────────────────────────

  function request(): CreateProjectRequest {
    const list = (id: QuestionId) => {
      const v = value(id).sel.v
      return Array.isArray(v) ? v : []
    }
    const th = value('theme').sel
    const data = value('data').sel
    const team = value('team')
    // Free-text answers have no structured field; keep them as requirements so nothing is lost.
    const notes = QUESTIONS.flatMap((q) =>
      state.answers[q.id]?.text ? [`${q.id}: ${state.answers[q.id]!.text}`] : [],
    )
    return {
      name: state.name.trim() || state.brief?.name || 'New app',
      purpose: state.brief?.tagline ?? '',
      requirements: [...state.reqs.filter((r) => r.on).map((r) => r.text), ...notes],
      signIn: list('signin'),
      modules: list('modules'),
      theme: {
        color: brandHex(String(th.color)),
        mode: th.mode as CreateProjectRequest['theme']['mode'],
        radius: th.radius as CreateProjectRequest['theme']['radius'],
      },
      languages: list('langs'),
      team: list('team').map((userId) => ({
        userId,
        role: userId === meId() ? 'owner' : (team.roles[userId] ?? DEFAULT_ROLE),
      })),
      data: {
        engine: String(data.engine),
        storage: data.storage === 'shared' ? 'shared' : 'new',
        sample: data.sample !== 'empty',
      },
    }
  }

  function tick() {
    const last = BUILD_TASKS.length - 1
    // Hold on the last task until the server has actually created the project.
    if (state.gen < last) state.gen++
    else if (state.result) {
      state.gen = BUILD_TASKS.length
      state.phase = 'done'
      stopTicker()
    }
  }

  function submit() {
    const r = run
    state.buildError = null
    stopTicker()
    ticker = setInterval(tick, T.buildTick)
    deps.create(request()).then(
      (p) => {
        if (r === run) state.result = p
      },
      (e: unknown) => {
        if (r !== run) return
        stopTicker()
        state.buildError = e instanceof Error ? e.message : 'Something went wrong'
      },
    )
  }

  function create() {
    if (state.phase !== 'summary') return
    if (!state.name.trim()) state.name = state.brief?.name ?? 'New app'
    state.phase = 'building'
    state.gen = 0
    state.result = null
    submit()
  }

  function retry() {
    if (state.phase === 'building' && state.buildError) submit()
  }

  function restart() {
    dispose()
    run++
    Object.assign(state, initial(deps.initialInput ?? ''))
  }

  return {
    state,
    question,
    locked,
    stageIndex,
    answeredCount,
    inScope,
    theme,
    valid,
    canStart,
    teamIds,
    value,
    person,
    request,
    addFiles,
    removeFile,
    start,
    toggleRequirement,
    addRequirement,
    continueBrief,
    next,
    skip,
    back,
    edit,
    pick,
    pickByIndex,
    addMember,
    removeMember,
    setRole,
    create,
    retry,
    restart,
    dispose,
  }
}

export type NewProjectFlow = ReturnType<typeof createNewProjectFlow>

const KEY: InjectionKey<NewProjectFlow> = Symbol('new-project-flow')
export const provideFlow = (f: NewProjectFlow) => provide(KEY, f)
export function useFlow(): NewProjectFlow {
  const f = inject(KEY)
  if (!f) throw new Error('useFlow() outside NewProjectPage')
  return f
}
