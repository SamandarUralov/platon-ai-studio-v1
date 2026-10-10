import { describe, expect, it } from 'vitest'
import type { ComponentProp, CustomComponent } from '@platon/definition'
import { sandboxSeed } from '../../../../../../mocks/src/seed/components'
import { fieldopsDefinition } from '@platon/mocks/seed'
import {
  buildMeta,
  componentNameError,
  parseEmits,
  parseProps,
  propNameError,
  propsBlock,
  propsFromCode,
  scaffoldSource,
  syncProps,
  syncState,
} from '../sfc'

const P = (x: Partial<ComponentProp> & Pick<ComponentProp, 'name'>): ComponentProp => ({
  label: x.name,
  type: 'String',
  input: 'text',
  required: false,
  ...x,
})

const SRC = `<template><div /></template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Hello, {world}' },
  count: Number,
  items: { type: Array, required: true },
  size: { type: String, default: "comfortable", validator: (v) => ['compact', 'comfortable'].includes(v) },
})
const emit = defineEmits(['select', "change"])
const x = computed(() => ({ a: 1 }))
</script>
`

describe('propNameError', () => {
  it('accepts camelCase names', () => {
    expect(propNameError('showProgress', ['title'])).toBeNull()
  })
  it('rejects empty, non-camel, reserved and duplicate names', () => {
    expect(propNameError('', [])).toBe('required')
    expect(propNameError('Title', [])).toBe('camel')
    expect(propNameError('show-progress', [])).toBe('camel')
    expect(propNameError('1st', [])).toBe('camel')
    expect(propNameError('class', [])).toBe('reserved')
    expect(propNameError('key', [])).toBe('reserved')
    expect(propNameError('title', ['title'])).toBe('duplicate')
  })
})

describe('componentNameError', () => {
  it('wants PascalCase and unique names', () => {
    expect(componentNameError('RatingStars', ['JobTimeline'])).toBeNull()
    expect(componentNameError('ratingStars', [])).toBe('pascal')
    expect(componentNameError('JobTimeline', ['JobTimeline'])).toBe('duplicate')
    expect(componentNameError('', [])).toBe('required')
  })
})

describe('parseProps', () => {
  it('reads object and shorthand declarations without evaluating code', () => {
    const ps = parseProps(SRC)!
    expect(ps.map((p) => p.name)).toEqual(['title', 'count', 'items', 'size'])
    expect(ps[0]).toMatchObject({ type: 'String', required: false, default: 'Hello, {world}' })
    expect(ps[1]).toMatchObject({ type: 'Number', required: false })
    expect(ps[2]).toMatchObject({ type: 'Array', required: true })
    expect(ps[3]).toMatchObject({ default: 'comfortable', options: ['compact', 'comfortable'] })
  })
  it('returns null without a runtime defineProps block', () => {
    expect(parseProps('<script setup lang="ts">defineProps<{ a: string }>()</script>')).toBeNull()
  })
})

describe('parseEmits', () => {
  it('reads array and typed forms', () => {
    expect(parseEmits(SRC)).toEqual(['select', 'change'])
    expect(parseEmits(`defineEmits<{ (e: 'save', v: string): void; (e: 'clear'): void }>()`)).toEqual([
      'save',
      'clear',
    ])
    expect(parseEmits(`defineEmits<{ change: [n: number]; 'update:value': [v: string] }>()`)).toEqual([
      'change',
      'update:value',
    ])
    expect(parseEmits('no emits')).toEqual([])
  })
})

describe('syncProps', () => {
  const props = [
    P({ name: 'title', default: "It's" }),
    P({ name: 'max', type: 'Number', input: 'slider', default: '7' }),
    P({ name: 'rows', type: 'Array', input: 'source', required: true }),
  ]

  it('rewrites only the defineProps block', () => {
    const out = syncProps(SRC, props)
    expect(out).toContain(propsBlock(props))
    expect(out).toContain(`title: { type: String, default: 'It\\'s' },`)
    expect(out).toContain('max: { type: Number, default: 7 },')
    expect(out).toContain('rows: { type: Array, required: true },')
    expect(out).toContain('const emit = defineEmits([\'select\', "change"])')
    expect(out).toContain('const x = computed(() => ({ a: 1 }))')
    expect(out.startsWith('<template><div /></template>')).toBe(true)
  })

  it('writes select validators and round-trips through parseProps', () => {
    const ps = [P({ name: 'size', input: 'select', default: 'compact', options: ['compact', 'comfortable'] })]
    const out = syncProps(scaffoldSource('Thing'), ps)
    expect(out).toContain("validator: (v) => ['compact', 'comfortable'].includes(v)")
    expect(syncState(out, ps)).toEqual({ kind: 'ok' })
  })

  it('leaves code alone when a name is invalid or there is no block', () => {
    expect(syncProps(SRC, [P({ name: 'class' })])).toBe(SRC)
    expect(syncProps('<template />', props)).toBe('<template />')
  })
})

describe('syncState', () => {
  it('detects missing blocks, code-only props and differences', () => {
    expect(syncState('<template />', [])).toEqual({ kind: 'missing' })
    expect(syncState(SRC, [P({ name: 'title' })])).toEqual({
      kind: 'codeOnly',
      names: ['count', 'items', 'size'],
    })
    const all = propsFromCode(parseProps(SRC)!)
    expect(syncState(SRC, all)).toEqual({ kind: 'ok' })
    expect(
      syncState(
        SRC,
        all.map((p) => (p.name === 'items' ? { ...p, required: false } : p)),
      ),
    ).toEqual({ kind: 'differs' })
  })

  it('treats the seeded sandbox sources as in sync with the seed definition', () => {
    const def = fieldopsDefinition()
    for (const f of sandboxSeed()) {
      const c = def.components.find((x) => x.id === f.componentId)!
      expect(syncState(f.content, c.props), c.name).toEqual({ kind: 'ok' })
      expect(parseEmits(f.content)).toEqual(c.events)
    }
  })
})

describe('buildMeta', () => {
  it('produces the metadata contract', () => {
    const c: CustomComponent = {
      id: 'component:rating_stars',
      kind: 'vue-component',
      name: 'RatingStars',
      folder: 'components',
      file: 'src/components/RatingStars.vue',
      source: { type: 'ai', prompt: 'Stars' },
      props: [
        P({ name: 'value', type: 'Number', input: 'number', default: '3' }),
        P({ name: 'rows', type: 'Array', input: 'source', required: true }),
        P({ name: 'size', input: 'select', default: 'sm', options: ['sm', 'lg'] }),
      ],
      events: ['change'],
      status: 'needs_review',
    }
    expect(buildMeta(c)).toEqual({
      id: 'component:rating_stars',
      kind: 'vue-component',
      name: 'RatingStars',
      file: 'src/components/RatingStars.vue',
      source: { type: 'ai', prompt: 'Stars' },
      props: [
        { name: 'value', label: 'value', type: 'Number', input: 'number', required: false, default: 3 },
        { name: 'rows', label: 'rows', type: 'Array', input: 'source', required: true },
        {
          name: 'size',
          label: 'size',
          type: 'String',
          input: 'select',
          required: false,
          default: 'sm',
          options: ['sm', 'lg'],
        },
      ],
      events: ['change'],
    })
  })
})
