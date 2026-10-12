/** Rows of blocks on the 12-column grid (`span` in the definition). */
import { rowSpans, type Block } from '@platon/definition'

// Full literals so Tailwind finds every class.
const SPAN_CLASS = [
  '',
  'col-span-1',
  'col-span-2',
  'col-span-3',
  'col-span-4',
  'col-span-5',
  'col-span-6',
  'col-span-7',
  'col-span-8',
  'col-span-9',
  'col-span-10',
  'col-span-11',
  'col-span-12',
] as const

/** Grid classes per block of a row; on narrow screens every block takes the full row. */
export function rowGridClasses(row: Pick<Block, 'span'>[]): string[] {
  return rowSpans(row).map((s) => `${SPAN_CLASS[s]} @max-[560px]:col-span-full`)
}
