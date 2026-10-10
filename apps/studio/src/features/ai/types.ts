/** What the Studio AI panel is looking at; attached as a context chip and sent with prompts. */
import type { AiContextRef } from '@platon/definition'

export type AiContext = AiContextRef

/** An entry in the `/` (skills, context, templates) or `@` (context) menu. */
export interface PickItem {
  kind: 'skill' | 'ctx' | 'tpl'
  key: string
  label: string
  desc: string
  /** lucide kebab-case icon name */
  icon: string
  /** "/table" for skills */
  cmd?: string
  skill?: string
  context?: AiContext
  prompt?: string
}

export interface PickGroup {
  label: string
  items: PickItem[]
}

/** One slice of the context-usage ring. */
export interface RingRow {
  key: string
  label: string
  desc: string
  tokens: number
  /** Tailwind bg-* token class for the swatch */
  swatch: string
}
