<script setup lang="ts">
import { computed } from 'vue'
import { type BlockProps, CARD, str, tr, useResolved } from './props'
import {
  arcPath,
  groupCounts,
  linePoints,
  niceMax,
  SAMPLE_BAR,
  SAMPLE_DONUT,
  SAMPLE_LINE,
  type Datum,
} from '../charts'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const t = computed(() => props.block.type)
const data = computed<Datum[]>(() => {
  const src = str(r.value.source)
  const real = groupCounts(props.ctx.definition, src, str(r.value.groupBy), props.ctx.records[src])
  if (real?.length) return real
  return t.value === 'bar' ? SAMPLE_BAR : t.value === 'line' ? SAMPLE_LINE : SAMPLE_DONUT
})
const max = computed(() => niceMax(Math.max(...data.value.map((d) => d.value))))
const ticks = computed(() => [4, 3, 2, 1, 0].map((i) => Math.round((max.value / 4) * i * 10) / 10))

const W = 600
const H = 160
const pts = computed(() => linePoints(data.value, W, H, max.value))
const poly = computed(() => pts.value.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' '))
const area = computed(() => `0,${H} ${poly.value} ${W},${H}`)

const SLICE = [
  'var(--app-primary-fg)',
  'var(--app-accent)',
  'var(--app-warn-fg)',
  'var(--app-faint)',
  'var(--app-purple-fg)',
  'var(--app-info-fg)',
]
const total = computed(() => data.value.reduce((a, d) => a + d.value, 0))
const slices = computed(() => {
  let a = 0
  return data.value.map((d, i) => {
    const a0 = a
    a += (d.value / (total.value || 1)) * Math.PI * 2
    return {
      ...d,
      d: arcPath(60, 60, 46, a0, a),
      color: SLICE[i % SLICE.length],
      pct: Math.round((d.value / (total.value || 1)) * 100),
    }
  })
})
const last = computed(() => data.value.at(-1))
</script>

<template>
  <div :class="CARD" class="p-4">
    <div class="mb-3 flex items-baseline gap-2">
      <span class="text-[14px] font-bold">{{ tr(props, 'title', r.title ?? '') }}</span>
      <template v-if="t === 'line' && last">
        <span class="ml-auto text-[18px] font-bold">{{ last.value }}</span>
      </template>
    </div>

    <!-- bar -->
    <div v-if="t === 'bar'" class="flex h-44 gap-2">
      <div class="flex flex-col justify-between pb-5 text-right text-[11px] text-(--app-faint)">
        <span v-for="k in ticks" :key="k">{{ k }}</span>
      </div>
      <div class="flex flex-1 items-end gap-3 border-b border-(--app-line) pb-0">
        <button
          v-for="(d, i) in data"
          :key="d.label"
          type="button"
          class="group flex h-full flex-1 flex-col items-center justify-end"
          @click.stop="emit('event', 'click', d)"
        >
          <span class="mb-1 text-[11px] font-semibold text-(--app-muted) opacity-0 group-hover:opacity-100">{{
            d.value
          }}</span>
          <span
            class="w-full max-w-10 rounded-t-[5px]"
            :class="i === data.length - 1 ? 'bg-(--app-accent)' : 'bg-(--app-accent-soft)'"
            :style="{ height: `${(d.value / max) * 100}%` }"
          />
          <span class="-mb-5 mt-1 truncate text-[11px] text-(--app-faint)">{{ d.label }}</span>
        </button>
      </div>
    </div>

    <!-- line -->
    <div v-else-if="t === 'line'">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        class="block h-40 w-full overflow-visible"
        @click.stop="emit('event', 'click', last)"
      >
        <polygon :points="area" fill="var(--app-accent-tint)" />
        <polyline
          :points="poly"
          fill="none"
          stroke="var(--app-accent)"
          stroke-width="2.5"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
        />
      </svg>
      <div class="mt-1.5 flex justify-between text-[11px] text-(--app-faint)">
        <span v-for="(d, i) in data" v-show="i % 2 === 0 || data.length < 8" :key="i">{{ d.label }}</span>
      </div>
    </div>

    <!-- donut -->
    <div v-else class="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 120 120" class="size-32 shrink-0">
        <path
          v-for="s in slices"
          :key="s.label"
          :d="s.d"
          fill="none"
          :stroke="s.color"
          stroke-width="16"
          class="cursor-pointer"
          @click.stop="emit('event', 'click', s)"
        />
        <text x="60" y="60" text-anchor="middle" class="fill-(--app-fg) text-[20px] font-bold">
          {{ total }}
        </text>
        <text x="60" y="76" text-anchor="middle" class="fill-(--app-faint) text-[10px]">total</text>
      </svg>
      <ul class="m-0 min-w-40 flex-1 list-none space-y-1.5 p-0 text-[12.5px]">
        <li v-for="s in slices" :key="s.label" class="flex items-center gap-2">
          <span class="size-2.5 rounded-full" :style="{ background: s.color }" />
          <span class="flex-1 truncate">{{ s.label }}</span>
          <span class="font-semibold">{{ s.value }}</span>
          <span class="w-9 text-right text-(--app-faint)">{{ s.pct }}%</span>
        </li>
      </ul>
    </div>
  </div>
</template>
