/** What a renderer needs to draw blocks. Plain data only — no Studio stores — so the runtime can reuse it. */
import type { AppDefinition } from '@platon/definition'

export type RecordRow = Record<string, unknown>

export interface Viewer {
  /** Role id (definition.roles[].id). */
  role: string
  name: string
  /** Extra values conditions can read, e.g. region. */
  vars?: Record<string, unknown>
}

/** Values page code changed at runtime, keyed by block ref (ctx.blocks.<ref>.<prop> = …). */
export type BlockOverrides = Record<string, Record<string, unknown>>

export interface RenderContext {
  definition: AppDefinition
  /** Loaded rows per table id. Missing table → still loading / not loaded. */
  records: Record<string, RecordRow[] | undefined>
  viewer?: Viewer
  /** App language code; falls back to definition.settings.defaultLanguage. */
  lang?: string
  overrides?: BlockOverrides
  /** Design mode: controls are inert and empty sources show placeholders. */
  design?: boolean
  /** "Today" for date filters; fixed in tests. */
  today?: string
}

export function translate(
  def: AppDefinition,
  lang: string | undefined,
  key: string,
  fallback: string,
): string {
  if (!lang || lang === def.settings.defaultLanguage) return fallback
  return def.translations[lang]?.[key] ?? fallback
}
