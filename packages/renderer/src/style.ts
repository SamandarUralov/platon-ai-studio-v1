/** Block style (user data) → inline CSS. Values come from the app definition, not Studio tokens. */
import type { BlockStyle } from '@platon/definition'

export const DEFAULT_STYLE: Required<BlockStyle> = {
  radius: 10,
  bg: 'transparent',
  color: '',
  pad: 0,
  margin: 0,
  border: 'none',
  shadow: 'none',
  width: 'full',
  align: 'left',
  font: 15,
}

const BORDER = {
  none: 'none',
  light: '1px solid var(--app-line)',
  strong: '1.5px solid var(--app-fg)',
  accent: '1.5px solid var(--app-accent)',
}
const SHADOW = {
  none: 'none',
  soft: '0 2px 10px rgba(20,20,40,.07)',
  raised: '0 12px 32px rgba(20,20,40,.14)',
}
export const WIDTH_PX = { full: undefined, wide: 880, medium: 640, narrow: 440 } as const

export function blockStyle(s: BlockStyle | undefined): Record<string, string> {
  if (!s) return {}
  const out: Record<string, string> = {}
  if (s.radius !== undefined) out.borderRadius = `${s.radius}px`
  if (s.bg && s.bg !== 'transparent') out.background = s.bg
  if (s.color) out.color = s.color
  if (s.pad) out.padding = `${s.pad}px`
  if (s.margin) out.marginTop = `${s.margin}px`
  if (s.border && s.border !== 'none') out.border = BORDER[s.border]
  if (s.shadow && s.shadow !== 'none') out.boxShadow = SHADOW[s.shadow]
  const w = s.width ? WIDTH_PX[s.width] : undefined
  if (w) {
    out.maxWidth = `${w}px`
    if (s.align === 'center') out.marginInline = 'auto'
    else if (s.align === 'right') out.marginLeft = 'auto'
  }
  if (s.align && s.align !== 'left') out.textAlign = s.align
  if (s.font && s.font !== DEFAULT_STYLE.font) out.fontSize = `${s.font}px`
  return out
}

/** Number of style keys that differ from the default (inspector badge). */
export function changedStyleCount(s: BlockStyle | undefined): number {
  if (!s) return 0
  return (Object.keys(s) as (keyof BlockStyle)[]).filter(
    (k) => s[k] !== undefined && s[k] !== DEFAULT_STYLE[k],
  ).length
}
