/** Semantic colour tones shared by badges, dots, pills and alerts. */
export type Tone = 'neutral' | 'primary' | 'ok' | 'warn' | 'danger' | 'purple' | 'teal' | 'info' | 'ai'

export const toneClasses: Record<Tone, { fg: string; bg: string; dot: string; border: string }> = {
  neutral: { fg: 'text-fg-2', bg: 'bg-subtle', dot: 'bg-faint', border: 'border-line' },
  primary: {
    fg: 'text-primary-strong',
    bg: 'bg-primary-tint',
    dot: 'bg-primary',
    border: 'border-primary-ring',
  },
  ok: { fg: 'text-ok', bg: 'bg-ok-bg', dot: 'bg-ok-dot', border: 'border-ok/30' },
  warn: { fg: 'text-warn', bg: 'bg-warn-bg', dot: 'bg-warn-dot', border: 'border-warn/30' },
  danger: { fg: 'text-danger', bg: 'bg-danger-bg', dot: 'bg-danger-dot', border: 'border-danger/30' },
  purple: { fg: 'text-purple', bg: 'bg-purple-bg', dot: 'bg-purple', border: 'border-purple/30' },
  teal: { fg: 'text-teal', bg: 'bg-teal-bg', dot: 'bg-teal', border: 'border-teal/30' },
  info: { fg: 'text-info', bg: 'bg-info-bg', dot: 'bg-info', border: 'border-info/30' },
  ai: { fg: 'text-ai', bg: 'bg-ai-bg', dot: 'bg-ai', border: 'border-ai/30' },
}
