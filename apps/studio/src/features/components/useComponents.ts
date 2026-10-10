/**
 * Component-screen state that outlives a single view: sample values (per browser), running AI
 * generations, and the definition edits for components (always through `def.apply`, area Components).
 */
import { computed, reactive } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import {
  camel,
  newId,
  pointer,
  uniqueName,
  type Block,
  type ComponentProp,
  type CustomComponent,
  type GenerateComponentRequest,
} from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { generateComponent } from './api'
import { shortId } from './sfc'

// ── Sample values (Inputs preview) ────────────────────────────────────────────────────────────

export const samples = useLocalStorage<Record<string, Record<string, unknown>>>('platon.componentSamples', {})

export function useSamples(componentId: () => string | undefined) {
  const values = computed(() => samples.value[componentId() ?? ''] ?? {})
  function set(name: string, value: unknown) {
    const id = componentId()
    if (!id) return
    samples.value = { ...samples.value, [id]: { ...samples.value[id], [name]: value } }
  }
  return { values, set }
}

// ── AI generation ─────────────────────────────────────────────────────────────────────────────

export interface GenerationJob {
  prompt: string
  path: string
  /** 1 create file · 2 write code · 3 property fields · 4 done */
  step: 1 | 2 | 3 | 4
  source: string
  shownLines: number
  error?: string
}

export const generations = reactive(new Map<string, GenerationJob>())

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Definition edits ──────────────────────────────────────────────────────────────────────────

export function useComponentActions() {
  const def = useDefinitionStore()
  const at = (id: string, ...rest: (string | number)[]) => pointer('components', id, ...rest)

  function add(c: CustomComponent, text: string) {
    return def.apply({
      key: `components.${shortId(c.id)}`,
      area: 'Components',
      text,
      ops: [{ op: 'add', path: '/components/-', value: c }],
    })
  }

  function setProps(c: CustomComponent, props: ComponentProp[], text: string) {
    return def.apply({
      key: `components.${shortId(c.id)}.props`,
      area: 'Components',
      text,
      ops: [{ op: 'replace', path: at(c.id, 'props'), value: props }],
    })
  }

  function setEvents(c: CustomComponent, events: string[]) {
    return def.apply({
      key: `components.${shortId(c.id)}.events`,
      area: 'Components',
      text: `Updated events of “${c.name}”`,
      ops: [{ op: 'replace', path: at(c.id, 'events'), value: events }],
    })
  }

  function setStatus(c: CustomComponent, status: CustomComponent['status'], text: string) {
    return def.apply({
      key: `components.${shortId(c.id)}.status`,
      area: 'Components',
      text,
      ops: [{ op: 'replace', path: at(c.id, 'status'), value: status }],
    })
  }

  /** Append a `custom` block for the component on a new last row of the page. */
  function addToPage(c: CustomComponent, pageId: string): Block | null {
    const page = def.definition?.interface.pages.find((p) => p.id === pageId)
    if (!page) return null
    const row = page.blocks.reduce((m, b) => Math.max(m, b.row), -1) + 1
    const props: Record<string, unknown> = {}
    for (const p of c.props) if (p.default !== undefined) props[p.name] = p.default
    const block: Block = {
      id: newId('blk'),
      type: 'custom',
      ref: uniqueName(
        camel(c.name),
        page.blocks.map((b) => b.ref),
      ),
      row,
      title: c.name,
      props,
      component: c.id,
    }
    const ok = def.apply({
      key: `interface.pages.${page.id}.blocks.${block.id}`,
      area: 'Pages',
      text: `Added ${c.name} to ${page.name}`,
      ops: [{ op: 'add', path: pointer('interface', 'pages', page.id, 'blocks', '-'), value: block }],
    })
    return ok ? block : null
  }

  /**
   * AI path: the server writes the file and returns metadata; we add the component as `building`,
   * reveal the code progressively, then write its property fields and mark it for review.
   */
  async function generate(pid: string, req: GenerateComponentRequest): Promise<CustomComponent> {
    const res = await generateComponent(pid, req)
    const final = res.component
    const job: GenerationJob = {
      prompt: req.prompt,
      path: final.file,
      step: 2,
      source: res.source,
      shownLines: 0,
    }
    generations.set(final.id, job)
    add(
      { ...final, props: [], events: [], status: 'building' },
      `Added component “${final.name}” with Studio AI`,
    )
    void (async () => {
      const lines = res.source.split('\n').length
      const live = () => generations.get(final.id)
      while (live() && live()!.shownLines < lines) {
        await sleep(45)
        const j = live()
        if (j) j.shownLines = Math.min(lines, j.shownLines + 2)
      }
      const j = live()
      if (!j) return
      j.step = 3
      await sleep(700)
      const c = def.definition?.components.find((x) => x.id === final.id)
      if (c) {
        setProps(c, final.props, `Generated ${final.props.length} property fields for “${final.name}”`)
        setEvents(c, final.events)
        setStatus(c, 'needs_review', `“${final.name}” is ready for review`)
      }
      j.step = 4
      await sleep(400)
      generations.delete(final.id)
    })()
    return final
  }

  return { add, setProps, setEvents, setStatus, addToPage, generate }
}
