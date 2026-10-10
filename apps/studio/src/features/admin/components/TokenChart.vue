<script setup lang="ts">
/** Daily token usage (millions), stacked input/output bars. Token colours, hover readout, legend. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AiUsageDay } from '@platon/definition'
import { fmtDate } from '@/composables/format'

const props = defineProps<{ days: AiUsageDay[] }>()
const { t } = useI18n()

const H = 140
const W = 680
const BAR_GAP = 4
const max = computed(() => Math.max(1, ...props.days.map((d) => d.input + d.output)))
const step = computed(() => W / Math.max(1, props.days.length))
const bw = computed(() => Math.max(4, step.value - BAR_GAP))
const y = (v: number) => (v / max.value) * (H - 8)
const ticks = computed(() => {
  const top = Math.ceil(max.value)
  return [0, top / 2, top].map((v) => ({ v, y: H - y(v) }))
})
const hover = ref<number | null>(null)
const active = computed(() => (hover.value === null ? null : props.days[hover.value]))
const total = computed(() => props.days.reduce((n, d) => n + d.input + d.output, 0))
</script>

<template>
  <div>
    <div class="mb-2 flex flex-wrap items-center gap-3.5 text-xs text-muted">
      <span class="flex items-center gap-1.5"
        ><span class="size-2.5 rounded-[3px] bg-primary" />{{ t('admin.ai.input') }}</span
      >
      <span class="flex items-center gap-1.5"
        ><span class="size-2.5 rounded-[3px] bg-primary-ring" />{{ t('admin.ai.output') }}</span
      >
      <span class="ml-auto font-semibold text-fg-2">
        <template v-if="active"
          >{{ fmtDate(active.date, 'MMM D') }} · {{ active.input.toFixed(1) }}M {{ t('admin.ai.in') }} ·
          {{ active.output.toFixed(1) }}M {{ t('admin.ai.out') }}</template
        >
        <template v-else>{{ t('admin.ai.last30', { n: total.toFixed(1) }) }}</template>
      </span>
    </div>
    <svg
      :viewBox="`-30 0 ${W + 30} ${H + 18}`"
      class="block h-auto w-full"
      role="img"
      :aria-label="t('admin.ai.chartLabel')"
      @mouseleave="hover = null"
    >
      <g v-for="tk in ticks" :key="tk.v">
        <line x1="0" :x2="W" :y1="tk.y" :y2="tk.y" class="stroke-line-soft" stroke-width="1" />
        <text x="-6" :y="tk.y + 3.5" text-anchor="end" font-size="10" class="fill-faint">
          {{ tk.v.toFixed(tk.v < 10 && tk.v % 1 ? 1 : 0) }}M
        </text>
      </g>
      <g v-for="(d, i) in days" :key="d.date" @mouseenter="hover = i">
        <rect :x="i * step" y="0" :width="step" :height="H" fill="transparent" />
        <rect
          :x="i * step + BAR_GAP / 2"
          :y="H - y(d.input)"
          :width="bw"
          :height="Math.max(1, y(d.input))"
          rx="2"
          :class="hover === null || hover === i ? 'fill-primary' : 'fill-primary/40'"
        />
        <rect
          :x="i * step + BAR_GAP / 2"
          :y="H - y(d.input) - y(d.output) - 1.5"
          :width="bw"
          :height="Math.max(1, y(d.output) - 0.5)"
          rx="2"
          :class="hover === null || hover === i ? 'fill-primary-ring' : 'fill-primary-ring/40'"
        />
        <text
          v-if="i % 7 === 0"
          :x="i * step + step / 2"
          :y="H + 14"
          text-anchor="middle"
          font-size="10"
          class="fill-faint"
        >
          {{ fmtDate(d.date, 'MMM D') }}
        </text>
        <title>
          {{ fmtDate(d.date, 'MMM D') }}: {{ d.input.toFixed(1) }}M in, {{ d.output.toFixed(1) }}M out
        </title>
      </g>
    </svg>
  </div>
</template>
