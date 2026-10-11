/** Shared typing for block components: definition props merged with runtime overrides. */
import { computed } from 'vue'
import type { Block } from '@platon/definition'
import type { RenderContext } from '../context'
import { translate } from '../context'

export interface BlockProps {
  block: Block
  ctx: RenderContext
}

/** What a container hands to its `cell` slot for each of its cells. */
export interface CellSlotProps {
  slot: number
  count: number
  /** none | sm | md | lg */
  gap: string
  direction: 'column' | 'row'
}

export const GAP_CLASS: Record<string, string> = { none: 'gap-0', sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }

export type BlockEmit = (e: 'event', name: string, arg?: unknown) => void

/** Loosely typed view of `block.props` + `title`, with page-code overrides on top. */
export type ResolvedProps = Record<string, unknown> & { title?: string }

export function useResolved(p: BlockProps) {
  return computed<ResolvedProps>(() => ({
    title: p.block.title,
    ...(p.block.props as Record<string, unknown>),
    ...(p.ctx.overrides?.[p.block.ref] ?? {}),
  }))
}

export const str = (v: unknown, d = ''): string =>
  typeof v === 'string' ? v : v === undefined || v === null ? d : String(v)
export const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(',').map((s) => s.trim()) : []

/** Translate a block text via definition.translations (key: block.<id>.<prop>). */
export function tr(p: BlockProps, prop: string, text: string): string {
  return translate(p.ctx.definition, p.ctx.lang, `block.${p.block.id}.${prop}`, text)
}

export const CARD = 'rounded-(--app-radius-lg) border border-(--app-line) bg-(--app-surface)'
export const FIELD =
  'h-9 w-full rounded-(--app-radius) border border-(--app-line) bg-(--app-surface) px-3 text-[13px] text-(--app-fg) outline-none focus:border-(--app-accent)'
