<script setup lang="ts">
/**
 * Static preview of a custom Vue component (port of the mockup's CustomPreview). Used by the Interface
 * palette, canvas blocks and the component screen. It never runs the component's code: it renders a
 * representative shape driven by the component's props and the given values.
 * Contract: `component` null → "no longer exists" state; `building` → skeleton; `zoom` scales it;
 * interactive variants (rating) emit `update:value`.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LoaderCircle, TriangleAlert } from 'lucide-vue-next'
import type { CustomComponent } from '@platon/definition'
import { valueOf } from './sfc'

const props = defineProps<{
  component: CustomComponent | null | undefined
  values?: Record<string, unknown>
  building?: boolean
  zoom?: number
}>()
const emit = defineEmits<{ 'update:value': [name: string, value: unknown] }>()
const { t } = useI18n()

const V = computed<Record<string, unknown>>(() => {
  const out: Record<string, unknown> = {}
  for (const p of props.component?.props ?? []) {
    let v = valueOf(p, props.values)
    if (v === 'true') v = true
    if (v === 'false') v = false
    out[p.name] = v
  }
  return out
})
const has = (n: string) => !!props.component?.props.some((p) => p.name === n)
/** User colours are data (component props), so they're the one place inline colours are fine. */
const colour = (x: unknown) => (typeof x === 'string' && /^#[0-9a-f]{3,8}$/i.test(x) ? x : undefined)

const kind = computed(() => {
  const c = props.component
  if (!c) return 'missing'
  if (props.building || c.status === 'building') return 'build'
  if (has('steps')) return 'timeline'
  if (/signature/i.test(c.name)) return 'signature'
  if (has('max') && has('value')) return 'rating'
  return 'generic'
})

const accent = computed(() => colour(V.value.accent))
const STEPS: [string, string, boolean][] = [
  ['Requested', 'Oct 2 · 09:14', true],
  ['Scheduled', 'Oct 3 · 11:30', true],
  ['Technician on site', 'Oct 6 · 08:05', true],
  ['Parts ordered', 'Oct 6 · 10:40', false],
  ['Signed off', 'Pending', false],
]
const compact = computed(() => V.value.size === 'compact' || V.value.compact === true)

const max = computed(() => Math.max(1, Math.min(10, Math.round(Number(V.value.max)) || 5)))
const rating = computed(() => Math.max(0, Math.min(max.value, Math.round(Number(V.value.value)) || 0)))
const readOnly = computed(() => V.value.readonly === true)
const star = computed(() => colour(V.value.color))

function rate(n: number) {
  if (!readOnly.value) emit('update:value', 'value', n)
}
</script>

<template>
  <div class="w-full text-fg" :style="zoom && zoom !== 1 ? { zoom } : undefined">
    <div
      v-if="kind === 'missing'"
      class="flex items-center gap-2 rounded-xl border border-dashed border-danger/40 bg-danger-bg p-4 text-base text-danger"
    >
      <TriangleAlert :size="14" class="shrink-0" />{{ t('components.pv.missing') }}
    </div>

    <div
      v-else-if="kind === 'build'"
      class="flex flex-col gap-2.5 rounded-xl border border-dashed border-primary-ring bg-surface p-[18px]"
      aria-busy="true"
    >
      <div class="flex items-center gap-2 text-base font-semibold text-primary-strong">
        <LoaderCircle :size="14" class="animate-spin" />{{
          t('components.pv.building', { name: component!.name })
        }}
      </div>
      <div class="h-3 w-2/5 animate-pulse rounded-md bg-subtle-2" />
      <div class="h-2.5 w-[85%] animate-pulse rounded-md bg-subtle" />
      <div class="h-2.5 w-[70%] animate-pulse rounded-md bg-subtle" />
    </div>

    <section
      v-else-if="kind === 'timeline'"
      class="rounded-xl border border-line-soft bg-surface"
      :class="compact ? 'p-3' : 'p-[18px]'"
    >
      <header class="flex items-baseline justify-between gap-3" :class="compact ? 'mb-2' : 'mb-3.5'">
        <h3 class="m-0 text-[16px] font-extrabold tracking-[-0.01em]">{{ V.title || component!.name }}</h3>
        <span
          v-if="V.showProgress !== false"
          class="text-md font-extrabold"
          :class="!accent && 'text-primary'"
          :style="accent ? { color: accent } : undefined"
          >60%</span
        >
      </header>
      <ol class="m-0 flex list-none flex-col p-0">
        <li v-for="([label, at, done], i) in STEPS" :key="label" class="flex gap-3">
          <div class="flex w-2.5 shrink-0 flex-col items-center">
            <span
              class="mt-1 size-2.5 shrink-0 rounded-full"
              :class="done ? !accent && 'bg-primary' : 'bg-line'"
              :style="done && accent ? { background: accent } : undefined"
            />
            <span
              v-if="i < STEPS.length - 1"
              class="w-0.5 flex-1"
              :class="done && STEPS[i + 1]![2] ? !accent && 'bg-primary' : 'bg-line-soft'"
              :style="done && STEPS[i + 1]![2] && accent ? { background: accent } : undefined"
            />
          </div>
          <div class="min-w-0" :class="compact ? 'pb-2' : 'pb-3.5'">
            <div class="text-md font-bold" :class="done ? 'text-fg' : 'text-faint'">{{ label }}</div>
            <div class="text-sm text-faint">{{ at }}</div>
          </div>
        </li>
      </ol>
    </section>

    <div
      v-else-if="kind === 'signature'"
      class="flex flex-col gap-2 rounded-xl border border-line-soft bg-surface p-4"
      :class="readOnly && 'opacity-60'"
    >
      <div class="text-md font-bold">{{ V.label || 'Signature' }}</div>
      <div
        class="grid h-[120px] place-items-center rounded-lg border border-dashed border-line font-[cursive] text-[26px] italic"
        :class="!colour(V.penColor) && 'text-fg'"
        :style="colour(V.penColor) ? { color: colour(V.penColor) } : undefined"
      >
        M. Chen
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm text-faint">{{
          readOnly ? t('components.pv.readOnly') : t('components.pv.signHint')
        }}</span>
        <span
          class="flex h-7 items-center rounded-[7px] border border-line bg-surface px-2.5 text-sm font-semibold"
          >{{ t('components.pv.clear') }}</span
        >
      </div>
    </div>

    <div
      v-else-if="kind === 'rating'"
      class="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft bg-surface px-4 py-3.5"
    >
      <div class="flex gap-1" role="radiogroup" :aria-label="component!.name">
        <button
          v-for="n in max"
          :key="n"
          type="button"
          role="radio"
          :aria-checked="n === rating"
          :aria-label="String(n)"
          :disabled="readOnly"
          class="border-0 bg-transparent p-0 text-[24px] leading-none disabled:cursor-default"
          :class="[
            n <= rating ? !star && 'text-warn-dot' : 'text-line',
            !readOnly && 'cursor-pointer hover:scale-110',
          ]"
          :style="n <= rating && star ? { color: star } : undefined"
          @click.stop="rate(n)"
        >
          ★
        </button>
      </div>
      <span class="text-base font-semibold text-muted">{{
        t('components.pv.ofMax', { v: rating, max })
      }}</span>
    </div>

    <div
      v-else
      class="rounded-xl border border-t-[3px] border-line-soft bg-surface"
      :class="[compact ? 'px-3 py-2.5' : 'px-[18px] py-4', !accent && 'border-t-primary']"
      :style="accent ? { borderTopColor: accent } : undefined"
    >
      <h3 class="m-0 text-xl font-extrabold">{{ V.title || component!.name }}</h3>
      <ul class="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
        <li
          v-for="n in ['Boiler inspection', 'Filter replacement', 'Roof leak repair']"
          :key="n"
          class="rounded-lg bg-subtle px-2.5 py-2 text-md"
        >
          {{ n }}
        </li>
      </ul>
    </div>
  </div>
</template>
