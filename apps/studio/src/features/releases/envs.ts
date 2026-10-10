/** Presentation helpers for environments and deployment states. */
import { FlaskConical, Globe, PencilRuler } from 'lucide-vue-next'
import type { EnvironmentState, EnvName } from '@platon/definition'
import type { Tone } from '@platon/ui'

export const ENV_META: Record<EnvName, { icon: typeof Globe; tone: Tone }> = {
  development: { icon: PencilRuler, tone: 'primary' },
  staging: { icon: FlaskConical, tone: 'warn' },
  production: { icon: Globe, tone: 'ok' },
}

export const STATUS_TONE: Record<EnvironmentState['status'], Tone> = {
  idle: 'neutral',
  pending: 'neutral',
  awaiting_approval: 'purple',
  running: 'primary',
  succeeded: 'ok',
  failed: 'danger',
  rolled_back: 'warn',
}
