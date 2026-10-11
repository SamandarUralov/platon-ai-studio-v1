<script setup lang="ts">
/**
 * Bar, line, area, horizontal bar, stacked bar, donut, pie, funnel and scatter charts.
 * Grouped counts from `source` + `groupBy` (sample data until a source is set). One series uses the
 * app accent; categories use the fixed series palette, folding extras into "Other".
 */
import { computed } from 'vue'
import { type BlockProps, CARD, str, tr, useResolved } from './props'
import {
  arcPath,
  foldOther,
  groupCounts,
  groupCounts2,
  linePoints,
  niceMax,
  numericPoints,
  SAMPLE_BAR,
  SAMPLE_DONUT,
  SAMPLE_FUNNEL,
  SAMPLE_LINE,
  SAMPLE_SCATTER,
  SAMPLE_STACKED,
  wedgePath,
  type Datum,
} from '../charts'
import { seriesColor } from '../theme'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const t = computed(() => props.block.type)
const src = computed(() => str(r.value.source))
const rows = computed(() => props.ctx.records[src.value])
const data = computed<Datum[]>(() => {
  const real = groupCounts(props.ctx.definition, src.value, str(r.value.groupBy), rows.value)
  if (real?.length) return real
  if (t.value === 'line' || t.value === 'area') return SAMPLE_LINE
  if (t.value === 'donut' || t.value === 'pie') return SAMPLE_DONUT
  if (t.value === 'funnel') return SAMPLE_FUNNEL
  return SAMPLE_BAR
})
const max = computed(() => niceMax(Math.max(...data.value.map((d) => d.value))))
const ticks = computed(() => [4, 3, 2, 1, 0].map((i) => Math.round((max.value / 4) * i * 10) / 10))

// line / area
const W = 600
const H = 160
const pts = computed(() => linePoints(data.value, W, H, max.value))
const poly = computed(() => pts.value.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' '))
const areaPts = computed(() => `0,${H} ${poly.value} ${W},${H}`)
const last = computed(() => data.value.at(-1))

// donut / pie
const parts = computed(() => foldOther(data.value))
const total = computed(() => parts.value.reduce((a, d) => a + d.value, 0))
const slices = computed(() => {
  let a = 0
  return parts.value.map((d, i) => {
    const a0 = a
    a += (d.value / (total.value || 1)) * Math.PI * 2
    return {
      ...d,
      d: t.value === 'pie' ? wedgePath(60, 60, 54, a0, a) : arcPath(60, 60, 46, a0, a),
      color: seriesColor(i),
      pct: Math.round((d.value / (total.value || 1)) * 100),
    }
  })
})

// horizontal bars: largest first
const ranked = computed(() => [...data.value].sort((a, b) => b.value - a.value).slice(0, 12))

// stacked
const stacked = computed(() => {
  const real = groupCounts2(
    props.ctx.definition,
    src.value,
    str(r.value.groupBy),
    str(r.value.seriesBy),
    rows.value,
  )
  return real?.labels.length ? real : SAMPLE_STACKED
})
const stackMax = computed(() =>
  niceMax(
    Math.max(
      1,
      ...stacked.value.labels.map((_, i) => stacked.value.series.reduce((a, s) => a + s.values[i]!, 0)),
    ),
  ),
)

// funnel
const first = computed(() => data.value[0]?.value || 1)

// scatter
const points = computed(
  () => numericPoints(rows.value, str(r.value.xField), str(r.value.yField)) ?? SAMPLE_SCATTER,
)
const xMax = computed(() => niceMax(Math.max(...points.value.map((p) => p.x))))
const yMax = computed(() => niceMax(Math.max(...points.value.map((p) => p.y))))
</script>

<template>
  <div :class="CARD" class="p-4">
    <div class="mb-3 flex items-baseline gap-2">
      <span class="text-[14px] font-bold">{{ tr(props, 'title', r.title ?? '') }}</span>
      <span v-if="(t === 'line' || t === 'area') && last" class="ml-auto text-[18px] font-bold">{{
        last.value
      }}</span>
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
          :title="`${d.label}: ${d.value}`"
          @click.stop="emit('event', 'click', d)"
        >
          <span class="mb-1 text-[11px] font-semibold text-(--app-muted) opacity-0 group-hover:opacity-100">{{
            d.value
          }}</span>
          <span
            class="w-full max-w-10 rounded-t-[4px]"
            :class="i === data.length - 1 ? 'bg-(--app-accent)' : 'bg-(--app-accent-soft)'"
            :style="{ height: `${(d.value / max) * 100}%` }"
          />
          <span class="mt-1 -mb-5 truncate text-[11px] text-(--app-faint)">{{ d.label }}</span>
        </button>
      </div>
    </div>

    <!-- line / area -->
    <div v-else-if="t === 'line' || t === 'area'" class="flex gap-2">
      <div
        v-if="t === 'area'"
        class="flex h-40 flex-col justify-between text-right text-[11px] text-(--app-faint)"
      >
        <span v-for="k in ticks" :key="k">{{ k }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          preserveAspectRatio="none"
          class="block h-40 w-full overflow-visible"
          @click.stop="emit('event', 'click', last)"
        >
          <template v-if="t === 'area'">
            <line
              v-for="i in 4"
              :key="i"
              x1="0"
              :x2="W"
              :y1="(H / 4) * (i - 1)"
              :y2="(H / 4) * (i - 1)"
              stroke="var(--app-line-soft)"
              vector-effect="non-scaling-stroke"
            />
          </template>
          <polygon
            :points="areaPts"
            :fill="t === 'area' ? 'var(--app-accent-soft)' : 'var(--app-accent-tint)'"
            :fill-opacity="t === 'area' ? 0.55 : 1"
          />
          <polyline
            :points="poly"
            fill="none"
            stroke="var(--app-accent)"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
            stroke-linejoin="round"
          />
        </svg>
        <div class="mt-1.5 flex justify-between text-[11px] text-(--app-faint)">
          <span
            v-for="(d, i) in data"
            v-show="i % 2 === 0 || data.length < 8"
            :key="i"
            :title="`${d.label}: ${d.value}`"
            >{{ d.label }}</span
          >
        </div>
      </div>
    </div>

    <!-- horizontal bars -->
    <ul v-else-if="t === 'hbar'" class="m-0 list-none space-y-2 p-0">
      <li v-for="d in ranked" :key="d.label">
        <button
          type="button"
          class="grid w-full grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-left text-[12.5px]"
          :title="`${d.label}: ${d.value}`"
          @click.stop="emit('event', 'click', d)"
        >
          <span class="truncate text-(--app-fg-2)">{{ d.label }}</span>
          <span class="h-3 overflow-hidden rounded-r-[4px] bg-(--app-subtle)">
            <span
              class="block h-full rounded-r-[4px] bg-(--app-accent)"
              :style="{ width: `${(d.value / max) * 100}%` }"
            />
          </span>
          <span class="w-8 text-right font-semibold">{{ d.value }}</span>
        </button>
      </li>
    </ul>

    <!-- stacked bars -->
    <div v-else-if="t === 'stacked'">
      <div class="flex h-44 gap-2">
        <div class="flex flex-col justify-between pb-5 text-right text-[11px] text-(--app-faint)">
          <span v-for="i in 5" :key="i">{{ Math.round((stackMax / 4) * (5 - i)) }}</span>
        </div>
        <div class="flex flex-1 items-end gap-3 border-b border-(--app-line)">
          <button
            v-for="(label, i) in stacked.labels"
            :key="label"
            type="button"
            class="flex h-full flex-1 flex-col items-center justify-end"
            :title="`${label}: ${stacked.series.map((s) => `${s.name} ${s.values[i]}`).join(', ')}`"
            @click.stop="emit('event', 'click', { label, values: stacked.series.map((s) => s.values[i]) })"
          >
            <span
              class="flex w-full max-w-10 flex-col-reverse gap-[2px]"
              :style="{
                height: `${(stacked.series.reduce((a, s) => a + s.values[i]!, 0) / stackMax) * 100}%`,
              }"
            >
              <span
                v-for="(s, k) in stacked.series"
                :key="s.name"
                class="w-full first:rounded-none last:rounded-t-[4px]"
                :style="{ flexGrow: s.values[i], background: seriesColor(k) }"
              />
            </span>
            <span class="mt-1 -mb-5 truncate text-[11px] text-(--app-faint)">{{ label }}</span>
          </button>
        </div>
      </div>
      <ul class="m-0 mt-7 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] text-(--app-fg-2)">
        <li v-for="(s, k) in stacked.series" :key="s.name" class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm" :style="{ background: seriesColor(k) }" />{{ s.name }}
        </li>
      </ul>
    </div>

    <!-- funnel -->
    <ol v-else-if="t === 'funnel'" class="m-0 list-none space-y-1.5 p-0">
      <li v-for="(d, i) in data" :key="d.label">
        <button
          type="button"
          class="relative mx-auto flex h-9 items-center justify-center rounded-[4px] bg-(--app-accent) px-3 text-[12.5px] font-semibold text-(--app-accent-fg)"
          :style="{ width: `${Math.max(22, (d.value / first) * 100)}%`, opacity: 1 - i * 0.12 }"
          :title="`${d.label}: ${d.value} (${Math.round((d.value / first) * 100)}%)`"
          @click.stop="emit('event', 'click', d)"
        >
          <span class="truncate">{{ d.label }} · {{ d.value }}</span>
        </button>
      </li>
    </ol>

    <!-- scatter -->
    <div v-else-if="t === 'scatter'" class="flex gap-2">
      <div class="flex h-44 flex-col justify-between pb-4 text-right text-[11px] text-(--app-faint)">
        <span v-for="i in 5" :key="i">{{ Math.round((yMax / 4) * (5 - i) * 10) / 10 }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <svg viewBox="0 0 600 176" preserveAspectRatio="none" class="block h-44 w-full overflow-visible">
          <line
            v-for="i in 5"
            :key="i"
            x1="0"
            x2="600"
            :y1="44 * (i - 1)"
            :y2="44 * (i - 1)"
            stroke="var(--app-line-soft)"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <div class="relative -mt-44 h-44">
          <button
            v-for="(p, i) in points"
            :key="i"
            type="button"
            class="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-(--app-accent) ring-2 ring-(--app-surface)"
            :style="{ left: `${(p.x / xMax) * 100}%`, bottom: `${(p.y / yMax) * 100}%` }"
            :title="`${p.label ? `${p.label}: ` : ''}${p.x}, ${p.y}`"
            @click.stop="emit('event', 'click', p)"
          />
        </div>
        <div class="mt-1 flex justify-between text-[11px] text-(--app-faint)">
          <span v-for="i in 5" :key="i">{{ Math.round((xMax / 4) * (i - 1) * 10) / 10 }}</span>
        </div>
      </div>
    </div>

    <!-- donut / pie -->
    <div v-else class="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 120 120" class="size-32 shrink-0">
        <path
          v-for="s in slices"
          :key="s.label"
          :d="s.d"
          :fill="t === 'pie' ? s.color : 'none'"
          :stroke="t === 'pie' ? 'var(--app-surface)' : s.color"
          :stroke-width="t === 'pie' ? 2 : 16"
          class="cursor-pointer"
          @click.stop="emit('event', 'click', s)"
        >
          <title>{{ s.label }}: {{ s.value }} ({{ s.pct }}%)</title>
        </path>
        <template v-if="t === 'donut'">
          <text x="60" y="60" text-anchor="middle" class="fill-(--app-fg) text-[20px] font-bold">
            {{ total }}
          </text>
          <text x="60" y="76" text-anchor="middle" class="fill-(--app-faint) text-[10px]">total</text>
        </template>
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
