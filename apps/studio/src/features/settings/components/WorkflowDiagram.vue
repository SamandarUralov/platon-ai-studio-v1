<script setup lang="ts">
/**
 * Compact state diagram: states in order, forward moves as arcs above, moves back as arcs below,
 * neighbours as straight arrows. Pure SVG coloured with token utilities so dark mode follows.
 */
import { computed } from 'vue'
import type { Workflow } from '@platon/definition'
import type { Tone } from '@platon/ui'

const props = defineProps<{ workflow: Workflow }>()

const W = 128
const GAP = 52
const H = 30
const TOP = 44
const FILL: Record<Tone, string> = {
  neutral: 'fill-subtle',
  primary: 'fill-primary-tint',
  ok: 'fill-ok-bg',
  warn: 'fill-warn-bg',
  danger: 'fill-danger-bg',
  purple: 'fill-purple-bg',
  teal: 'fill-teal-bg',
  info: 'fill-info-bg',
  ai: 'fill-ai-bg',
}
const TEXT: Record<Tone, string> = {
  neutral: 'fill-fg-2',
  primary: 'fill-primary-strong',
  ok: 'fill-ok',
  warn: 'fill-warn',
  danger: 'fill-danger',
  purple: 'fill-purple',
  teal: 'fill-teal',
  info: 'fill-info',
  ai: 'fill-ai',
}
const STROKE: Record<Tone, string> = {
  neutral: 'stroke-fg-2',
  primary: 'stroke-primary-strong',
  ok: 'stroke-ok',
  warn: 'stroke-warn',
  danger: 'stroke-danger',
  purple: 'stroke-purple',
  teal: 'stroke-teal',
  info: 'stroke-info',
  ai: 'stroke-ai',
}
const tone = (t?: string): Tone => (t && t in FILL ? (t as Tone) : 'neutral')

const nodes = computed(() =>
  props.workflow.states.map((s, i) => ({
    ...s,
    x: i * (W + GAP),
    tone: tone(s.tone),
    label: s.name.length > 17 ? `${s.name.slice(0, 16)}…` : s.name,
  })),
)
const index = computed(() => new Map(props.workflow.states.map((s, i) => [s.id, i])))

const edges = computed(() => {
  const out: { d: string; back: boolean; key: string }[] = []
  const seen = new Map<string, number>()
  for (const tr of props.workflow.transitions) {
    const a = index.value.get(tr.from)
    const b = index.value.get(tr.to)
    if (a === undefined || b === undefined || a === b) continue
    const lane = (seen.get(`${Math.min(a, b)}-${Math.max(a, b)}-${a < b}`) ?? 0) + 1
    seen.set(`${Math.min(a, b)}-${Math.max(a, b)}-${a < b}`, lane)
    const back = b < a
    if (!back && b === a + 1) {
      const x1 = a * (W + GAP) + W
      const x2 = b * (W + GAP) - 2
      out.push({ d: `M${x1},${TOP + H / 2} L${x2},${TOP + H / 2}`, back, key: `${tr.from}>${tr.to}` })
      continue
    }
    const x1 = a * (W + GAP) + W / 2 + (back ? -10 : 10)
    const x2 = b * (W + GAP) + W / 2 + (back ? 10 : -10)
    const span = Math.abs(b - a)
    const lift = Math.min(36, 14 + span * 8) + (lane - 1) * 6
    const y = back ? TOP + H : TOP
    const cy = back ? y + lift : y - lift
    out.push({
      d: `M${x1},${y} C${x1},${cy} ${x2},${cy} ${x2},${back ? y + 2 : y - 2}`,
      back,
      key: `${tr.from}>${tr.to}#${lane}`,
    })
  }
  return out
})

const width = computed(() => Math.max(1, nodes.value.length * (W + GAP) - GAP))
</script>

<template>
  <div class="overflow-x-auto scroll-thin">
    <svg
      :width="width + 8"
      :height="TOP * 2 + H"
      :viewBox="`-4 0 ${width + 8} ${TOP * 2 + H}`"
      role="img"
      :aria-label="`${workflow.name} states`"
      class="block"
    >
      <defs>
        <marker
          :id="`arrow-${workflow.id}`"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" class="fill-faint" />
        </marker>
      </defs>
      <path
        v-for="e in edges"
        :key="e.key"
        :d="e.d"
        fill="none"
        :class="e.back ? 'stroke-faint-2' : 'stroke-faint'"
        stroke-width="1.5"
        :stroke-dasharray="e.back ? '4 3' : undefined"
        :marker-end="`url(#arrow-${workflow.id})`"
      />
      <g v-for="n in nodes" :key="n.id">
        <title>{{ n.name }}</title>
        <rect :x="n.x" :y="TOP" :width="W" :height="H" rx="15" :class="FILL[n.tone]" />
        <rect
          v-if="n.final"
          :x="n.x + 2.5"
          :y="TOP + 2.5"
          :width="W - 5"
          :height="H - 5"
          rx="12.5"
          fill="none"
          :class="STROKE[n.tone]"
          stroke-width="1"
          opacity="0.5"
        />
        <text
          :x="n.x + W / 2"
          :y="TOP + H / 2 + 4.5"
          text-anchor="middle"
          font-size="12.5"
          font-weight="600"
          :class="TEXT[n.tone]"
        >
          {{ n.label }}
        </text>
      </g>
    </svg>
  </div>
</template>
