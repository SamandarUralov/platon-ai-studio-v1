<script setup lang="ts">
/** KPI card (one number, its change and a sparkline) and gauge (one value against a target). */
import { computed } from 'vue'
import { ArrowDownRight, ArrowUpRight } from 'lucide-vue-next'
import { type BlockProps, CARD, str, tr, useResolved } from './props'
import { useRows } from './useRows'
import { arcPath, linePoints, niceMax, SAMPLE_BAR } from '../charts'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const { table, rows, loaded } = useRows(props, r)
const title = computed(() => tr(props, 'title', r.value.title ?? ''))

// kpi
const value = computed(() => {
  const v = str(r.value.value)
  if (v) return v
  if (table.value) return loaded.value ? String(rows.value.length) : '…'
  return '1,284'
})
const delta = computed(() => str(r.value.delta, '+12%'))
const trend = computed(() => (/^[-−]/.test(delta.value) ? 'down' : /^\+/.test(delta.value) ? 'up' : 'flat'))
const spark = computed(() => {
  const d = SAMPLE_BAR
  const pts = linePoints(d, 100, 28, niceMax(Math.max(...d.map((x) => x.value))))
  return pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')
})

// gauge: a 180° arc from 9 o'clock to 3 o'clock
const target = computed(() => Math.max(1, Number(r.value.max) || 100))
const current = computed(() => Number(r.value.value ?? 72) || 0)
const share = computed(() => Math.min(1, Math.max(0, current.value / target.value)))
const track = arcPath(60, 60, 46, -Math.PI / 2, Math.PI / 2)
const fill = computed(() =>
  share.value > 0 ? arcPath(60, 60, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * share.value) : '',
)
</script>

<template>
  <button
    v-if="block.type === 'kpi'"
    type="button"
    :class="CARD"
    class="block w-full p-4 text-left"
    @click.stop="emit('event', 'click', value)"
  >
    <div class="text-[12.5px] font-semibold text-(--app-muted)">{{ title || 'Metric' }}</div>
    <div class="mt-1 flex items-end gap-3">
      <span class="text-[26px] leading-none font-bold tracking-tight"
        >{{ str(r.prefix) }}{{ value }}{{ str(r.suffix) }}</span
      >
      <svg
        v-if="r.sparkline !== false"
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        class="ml-auto h-7 w-24"
        aria-hidden="true"
      >
        <polyline
          :points="spark"
          fill="none"
          stroke="var(--app-accent)"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <div class="mt-2 flex items-center gap-1.5 text-[12px]">
      <span
        class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold"
        :class="
          trend === 'up'
            ? 'bg-(--app-ok-bg) text-(--app-ok-fg)'
            : trend === 'down'
              ? 'bg-(--app-danger-bg) text-(--app-danger-fg)'
              : 'bg-(--app-neutral-bg) text-(--app-neutral-fg)'
        "
      >
        <ArrowUpRight v-if="trend === 'up'" :size="12" /><ArrowDownRight
          v-else-if="trend === 'down'"
          :size="12"
        />{{ delta }}
      </span>
      <span class="text-(--app-faint)">{{ str(r.caption, 'vs last month') }}</span>
    </div>
  </button>

  <div v-else :class="CARD" class="flex flex-col items-center p-4">
    <div class="self-start text-[14px] font-bold">{{ title }}</div>
    <svg viewBox="0 0 120 70" class="mt-2 w-44" role="img" :aria-label="`${current} of ${target}`">
      <path :d="track" fill="none" stroke="var(--app-subtle)" stroke-width="12" stroke-linecap="round" />
      <path
        v-if="fill"
        :d="fill"
        fill="none"
        stroke="var(--app-accent)"
        stroke-width="12"
        stroke-linecap="round"
      />
      <text x="60" y="58" text-anchor="middle" class="fill-(--app-fg) text-[18px] font-bold">
        {{ current }}{{ str(r.unit, '%') }}
      </text>
    </svg>
    <div class="text-[12px] text-(--app-faint)">Target {{ target }}{{ str(r.unit, '%') }}</div>
  </div>
</template>
