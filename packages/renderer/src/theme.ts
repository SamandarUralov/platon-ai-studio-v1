/**
 * The generated app's own theme (definition.settings.theme), exposed as CSS variables scoped to the
 * app frame. These colours are user data, so they live here instead of in Studio tokens; the frame
 * always follows the app's mode, never the Studio theme.
 */
import type { AppTheme } from '@platon/definition'

export type AppTone = 'neutral' | 'primary' | 'ok' | 'warn' | 'danger' | 'purple' | 'teal' | 'info' | 'accent'

const LIGHT = {
  '--app-bg': '#ffffff',
  '--app-side': '#fbfbfd',
  '--app-surface': '#ffffff',
  '--app-subtle': '#f6f7f9',
  '--app-hover': '#f3f4f7',
  '--app-fg': '#17182a',
  '--app-fg-2': '#4a4c5e',
  '--app-muted': '#6b6d80',
  '--app-faint': '#9a9cab',
  '--app-line': '#e6e6ee',
  '--app-line-soft': '#efeff4',
}
const DARK: typeof LIGHT = {
  '--app-bg': '#14151c',
  '--app-side': '#181922',
  '--app-surface': '#1b1c26',
  '--app-subtle': '#22232e',
  '--app-hover': '#262733',
  '--app-fg': '#ececf3',
  '--app-fg-2': '#c4c5d4',
  '--app-muted': '#9a9cb0',
  '--app-faint': '#6c6e82',
  '--app-line': '#2e2f3c',
  '--app-line-soft': '#262733',
}

/** [background, foreground] per tone, light then dark. */
const TONES: Record<Exclude<AppTone, 'accent'>, [string, string, string, string]> = {
  neutral: ['#efeff4', '#4a4c5e', '#2a2b37', '#c4c5d4'],
  primary: ['#eef0ff', '#3f4bd8', '#23264a', '#9aa3ff'],
  ok: ['#e3f5ef', '#0e6b58', '#163a30', '#5fd3a8'],
  warn: ['#fff3df', '#9a5b00', '#3a2d14', '#f2b45a'],
  danger: ['#ffe9e7', '#b42318', '#3d1c1c', '#ff8a80'],
  purple: ['#f3ecff', '#6b3fc9', '#2e2347', '#c4a5ff'],
  teal: ['#e3f5ef', '#0e7c66', '#163a30', '#5fd3a8'],
  info: ['#dff1ff', '#1f6f99', '#15303f', '#7cc4ec'],
}

const RADIUS = { sharp: ['4px', '6px'], soft: ['10px', '14px'], round: ['16px', '22px'] } as const

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

/** Mix the accent with white/black to get a tint for selected menu items and soft fills. */
export function tint(hex: string, amount: number, dark = false): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const base = dark ? 20 : 255
  const c = rgb.map((v) => Math.round(v * amount + base * (1 - amount)))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

export function resolveMode(theme: AppTheme | undefined, prefersDark = false): 'light' | 'dark' {
  const m = theme?.mode ?? 'light'
  return m === 'system' ? (prefersDark ? 'dark' : 'light') : m
}

export function appThemeVars(theme: AppTheme | undefined, prefersDark = false): Record<string, string> {
  const dark = resolveMode(theme, prefersDark) === 'dark'
  const accent = theme?.color && hexToRgb(theme.color) ? theme.color : '#0e7c66'
  const [r, rl] = RADIUS[theme?.radius ?? 'soft']
  const vars: Record<string, string> = {
    ...(dark ? DARK : LIGHT),
    '--app-accent': accent,
    '--app-accent-fg': '#ffffff',
    '--app-accent-tint': tint(accent, dark ? 0.28 : 0.12, dark),
    '--app-accent-soft': tint(accent, dark ? 0.45 : 0.32, dark),
    '--app-radius': r,
    '--app-radius-lg': rl,
    'color-scheme': dark ? 'dark' : 'light',
  }
  for (const [tone, [lb, lf, db, df]] of Object.entries(TONES)) {
    vars[`--app-${tone}-bg`] = dark ? db : lb
    vars[`--app-${tone}-fg`] = dark ? df : lf
  }
  return vars
}

/** Tailwind-friendly classes for a tone pill inside the app frame. */
export function toneClass(tone: string | undefined): string {
  const t = (tone && tone in TONES ? tone : tone === 'accent' ? 'teal' : 'neutral') as keyof typeof TONES
  return {
    neutral: 'bg-(--app-neutral-bg) text-(--app-neutral-fg)',
    primary: 'bg-(--app-primary-bg) text-(--app-primary-fg)',
    ok: 'bg-(--app-ok-bg) text-(--app-ok-fg)',
    warn: 'bg-(--app-warn-bg) text-(--app-warn-fg)',
    danger: 'bg-(--app-danger-bg) text-(--app-danger-fg)',
    purple: 'bg-(--app-purple-bg) text-(--app-purple-fg)',
    teal: 'bg-(--app-teal-bg) text-(--app-teal-fg)',
    info: 'bg-(--app-info-bg) text-(--app-info-fg)',
  }[t]
}
