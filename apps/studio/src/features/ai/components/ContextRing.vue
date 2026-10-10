<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@platon/ui'
import { kfmt } from '../tokens'
import type { RingRow } from '../types'

const props = defineProps<{ rows: RingRow[]; max: number }>()
const { t } = useI18n()
const open = ref(false)

const total = computed(() => props.rows.reduce((a, r) => a + r.tokens, 0))
const pct = computed(() => Math.max(1, Math.round((total.value / props.max) * 100)))
const R = 8
const C = 2 * Math.PI * R
const ringTone = computed(() =>
  pct.value < 60 ? 'stroke-primary' : pct.value < 85 ? 'stroke-warn-dot' : 'stroke-danger-dot',
)
</script>

<template>
  <div class="relative" @mouseenter="open = true" @mouseleave="open = false">
    <button
      type="button"
      class="grid size-[30px] cursor-help place-items-center rounded-lg focus-visible:outline-2"
      :aria-label="`${t('ai.ctx.title')}: ${pct}%`"
      :aria-expanded="open"
      @focus="open = true"
      @blur="open = false"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" class="-rotate-90" aria-hidden="true">
        <circle cx="10" cy="10" :r="R" fill="none" stroke-width="4" class="stroke-line" />
        <circle
          cx="10"
          cy="10"
          :r="R"
          fill="none"
          stroke-width="4"
          :class="ringTone"
          :stroke-dasharray="`${(C * Math.min(pct, 100)) / 100} ${C}`"
        />
      </svg>
    </button>
    <div
      v-if="open"
      role="tooltip"
      class="pointer-events-none absolute right-[-40px] bottom-10 z-30 w-[272px] rounded-xl bg-ink px-3.5 py-3 text-on-ink shadow-modal"
    >
      <div class="flex items-baseline justify-between text-sm font-bold">
        <span>{{ t('ai.ctx.title') }}</span
        ><span>{{ pct }}%</span>
      </div>
      <div class="mt-0.5 text-xs opacity-65">{{ t('ai.ctx.of', { used: kfmt(total), max: kfmt(max) }) }}</div>
      <div class="my-2.5 flex h-1.5 overflow-hidden rounded-[3px] bg-on-ink/15">
        <div
          v-for="r in rows"
          :key="r.key"
          :class="r.swatch"
          :style="{ width: `${Math.max(1, (r.tokens / max) * 100)}%` }"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <div v-for="r in rows" :key="r.key" class="flex items-start gap-2">
          <span :class="cn('mt-1 size-2 shrink-0 rounded-[2px]', r.swatch)" />
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold">{{ r.label }}</div>
            <div class="text-2xs opacity-65">{{ r.desc }}</div>
          </div>
          <span class="font-mono text-xs opacity-85">{{ kfmt(r.tokens) }}</span>
        </div>
      </div>
      <div class="mt-2.5 border-t border-on-ink/15 pt-2 text-2xs leading-snug opacity-65">
        {{ pct < 60 ? t('ai.ctx.plenty') : t('ai.ctx.full') }}
      </div>
    </div>
  </div>
</template>
