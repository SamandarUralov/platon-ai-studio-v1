<script setup lang="ts">
/** Auto-laid-out flowchart of the layer tree; branches side by side, click a node to select it. */
import { computed } from 'vue'
import { STEPS, stepSummary, type Step } from '@platon/definition'
import { cn, toneClasses } from '@platon/ui'
import { flowLayout, FLOW } from '../../lib/flowLayout'
import ToneTile from '../ToneTile.vue'

const props = defineProps<{ steps: Step[]; selected: string | null; problems: Map<string, string> }>()
const emit = defineEmits<{ select: [id: string] }>()
const L = computed(() => flowLayout(props.steps))
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto bg-dots scroll-thin">
    <div class="relative mx-auto" :style="{ width: `${L.width}px`, height: `${L.height}px` }">
      <div
        v-for="(s, i) in L.segments"
        :key="i"
        class="absolute bg-line"
        :style="{ left: `${s.x}px`, top: `${s.y}px`, width: `${s.w}px`, height: `${s.h}px` }"
      />
      <div
        v-for="p in L.pills"
        :key="p.label"
        class="absolute grid h-[30px] w-20 -translate-x-1/2 place-items-center rounded-full bg-ink text-sm font-bold text-on-ink"
        :style="{ left: `${p.x}px`, top: `${p.y}px` }"
      >
        {{ p.label }}
      </div>
      <span
        v-for="(b, i) in L.labels"
        :key="`l${i}`"
        :class="
          cn(
            'absolute -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-2xs font-bold',
            toneClasses[STEPS[b.parentType].tone].bg,
            toneClasses[STEPS[b.parentType].tone].fg,
          )
        "
        :style="{ left: `${b.x}px`, top: `${b.y}px` }"
      >
        {{ b.label }}
      </span>
      <button
        v-for="n in L.nodes"
        :key="n.step.id"
        type="button"
        :class="
          cn(
            'absolute flex items-center gap-2 rounded-xl border bg-surface px-2.5 text-left shadow-xs',
            n.step.id === selected
              ? 'border-primary shadow-focus'
              : problems.has(n.step.id)
                ? 'border-danger/50'
                : 'border-line hover:border-primary-ring',
          )
        "
        :style="{ left: `${n.x}px`, top: `${n.y}px`, width: `${FLOW.W}px`, height: `${FLOW.H}px` }"
        :title="problems.get(n.step.id) ?? stepSummary(n.step)"
        @click="emit('select', n.step.id)"
      >
        <ToneTile :icon="STEPS[n.step.type].icon" :tone="STEPS[n.step.type].tone" size="sm" />
        <span class="min-w-0 flex-1">
          <span :class="cn('block text-2xs font-bold uppercase', toneClasses[STEPS[n.step.type].tone].fg)">{{
            STEPS[n.step.type].label
          }}</span>
          <span class="block truncate font-mono text-xs text-fg">{{ stepSummary(n.step) }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
