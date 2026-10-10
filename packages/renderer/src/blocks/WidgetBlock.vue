<script setup lang="ts">
/** Calendar, progress, timeline, tabs, steps, alert and pagination (Platon UI Kit). */
import { computed, ref } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Info,
  CircleCheck,
  TriangleAlert,
  CircleX,
  X,
  Check,
} from 'lucide-vue-next'
import { type BlockProps, CARD, list, str, tr, useResolved } from './props'
import { monthGrid, MONTH_NAMES } from '../calendar'
import { tableOf } from '../format'
import { toneClass } from '../theme'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const t = computed(() => props.block.type)
const title = computed(() => tr(props, 'title', r.value.title ?? ''))
const todayIso = computed(() => props.ctx.today ?? new Date().toISOString().slice(0, 10))

// calendar
const offset = ref(0)
const selected = ref<string | null>(null)
const month = computed(() => {
  const [y, m] = todayIso.value.split('-').map(Number)
  const d = new Date(y!, m! - 1 + offset.value, 1)
  return { y: d.getFullYear(), m: d.getMonth() }
})
const cells = computed(() => monthGrid(month.value.y, month.value.m, todayIso.value))
const events = computed(() => {
  const def = props.ctx.definition
  const table = tableOf(def, str(r.value.source))
  const out = new Map<string, { label: string; tone: string }[]>()
  if (!table) return out
  const dateKey =
    str(r.value.dateField) || table.fields.find((f) => f.type === 'date' || f.type === 'datetime')?.key
  const labelKey = str(r.value.labelField) || table.fields.find((f) => f.type === 'text')?.key
  const status = table.fields.find((f) => f.type === 'workflow_state')
  if (!dateKey) return out
  for (const row of props.ctx.records[table.id] ?? []) {
    const iso = str(row[dateKey]).slice(0, 10)
    const s =
      status &&
      def.workflows
        .find((w) => w.id === status.workflow)
        ?.states.find((x) => x.name === row[status.key] || x.id === row[status.key])
    const arr = out.get(iso) ?? []
    arr.push({ label: str(row[labelKey ?? 'id']), tone: s?.tone ?? 'primary' })
    out.set(iso, arr)
  }
  return out
})

// progress / timeline sample content (no data source in the kit yet)
const progress = [
  ['Sam Ortiz', 7, 8],
  ['Priya Nair', 5, 8],
  ['Leo Brandt', 8, 8],
  ['Ana Costa', 3, 8],
] as const
const timeline = [
  ['Sam Ortiz', 'completed WO-1042 · Boiler check', '10 min ago', 'ok'],
  ['Dispatcher', 'assigned WO-1047 to Priya Nair', '1 h ago', 'primary'],
  ['Northwind Clinics', 'requested a visit · Roof leak', '3 h ago', 'warn'],
  ['System', 'flagged WO-1031 as overdue', 'Yesterday', 'danger'],
] as const

// tabs / steps
const tabs = computed(() => {
  const l = list(r.value.tabs)
  return l.length ? l : ['Details', 'Parts', 'Photos']
})
const tab = ref(0)
const steps = computed(() => {
  const l = list(r.value.steps)
  return l.length ? l : ['Requested', 'Scheduled', 'In progress', 'Done']
})
const step = ref(Number(r.value.current ?? 2))
function go(i: number, kind: 'tab' | 'step') {
  if (kind === 'tab') tab.value = i
  else step.value = Math.max(0, Math.min(steps.value.length - 1, i))
  emit('event', 'change', i)
}

// alert
const dismissed = ref(false)
const ALERT = {
  info: { tone: 'primary', icon: Info },
  success: { tone: 'ok', icon: CircleCheck },
  warning: { tone: 'warn', icon: TriangleAlert },
  error: { tone: 'danger', icon: CircleX },
} as const
const alert = computed(
  () =>
    ALERT[
      (str(r.value.variant, 'warning') as keyof typeof ALERT) in ALERT
        ? (str(r.value.variant, 'warning') as keyof typeof ALERT)
        : 'warning'
    ],
)

// pagination
const size = ref(Number(r.value.pageSize) || 10)
const total = computed(() => Number(r.value.total) || 128)
const pages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))
const page = ref(1)
const nums = computed(() => {
  const c = page.value
  const set = [...new Set([1, c - 1, c, c + 1, pages.value].filter((n) => n >= 1 && n <= pages.value))].sort(
    (a, b) => a - b,
  )
  const out: (number | null)[] = []
  set.forEach((n, i) => {
    if (i && n - set[i - 1]! > 1) out.push(null)
    out.push(n)
  })
  return out
})
function goPage(n: number) {
  page.value = Math.max(1, Math.min(pages.value, n))
  emit('event', 'change', page.value)
}
</script>

<template>
  <!-- calendar -->
  <div v-if="t === 'calendar'" :class="CARD" class="overflow-hidden">
    <div class="flex items-center gap-2 border-b border-(--app-line) px-4 py-3">
      <span class="text-[14px] font-bold">{{ title }}</span>
      <span class="ml-auto min-w-32 text-center text-[13.5px] font-bold"
        >{{ MONTH_NAMES[month.m] }} {{ month.y }}</span
      >
      <button
        type="button"
        class="grid size-7 place-items-center rounded-(--app-radius) border border-(--app-line)"
        aria-label="Previous month"
        @click.stop="offset--"
      >
        <ChevronLeft :size="14" />
      </button>
      <button
        type="button"
        class="grid size-7 place-items-center rounded-(--app-radius) border border-(--app-line)"
        aria-label="Next month"
        @click.stop="offset++"
      >
        <ChevronRight :size="14" />
      </button>
      <button
        type="button"
        class="h-7 rounded-(--app-radius) border border-(--app-line) px-2.5 text-[12px] font-semibold"
        @click.stop="offset = 0"
      >
        Today
      </button>
    </div>
    <div class="grid grid-cols-7">
      <div
        v-for="d in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
        :key="d"
        class="border-b border-(--app-line) px-2.5 py-2 text-[11.5px] font-semibold text-(--app-faint)"
      >
        {{ d }}
      </div>
      <button
        v-for="c in cells"
        :key="c.iso"
        type="button"
        class="min-h-20 border-r border-b border-(--app-line-soft) p-1.5 text-left align-top nth-[7n]:border-r-0"
        @click.stop="((selected = c.iso), emit('event', 'select', c.iso))"
      >
        <span
          class="inline-grid size-6 place-items-center rounded-full text-[12px]"
          :class="[
            !c.inMonth ? 'text-(--app-faint)' : '',
            c.iso === selected
              ? 'bg-(--app-accent) font-bold text-(--app-accent-fg)'
              : c.today
                ? 'bg-(--app-accent-tint) font-bold text-(--app-accent)'
                : '',
          ]"
          >{{ c.day }}</span
        >
        <span
          v-for="(ev, i) in (events.get(c.iso) ?? []).slice(0, 2)"
          :key="i"
          class="mt-0.5 block truncate rounded px-1 text-[10.5px] font-semibold"
          :class="toneClass(ev.tone)"
          >{{ ev.label }}</span
        >
      </button>
    </div>
  </div>

  <!-- progress -->
  <div v-else-if="t === 'progress'" :class="CARD" class="p-4">
    <div class="mb-3 text-[14px] font-bold">{{ title }}</div>
    <div v-for="[l, v, mx] in progress" :key="l" class="mb-3 last:mb-0">
      <div class="mb-1 flex text-[12.5px]">
        <span class="font-medium">{{ l }}</span
        ><span class="ml-auto text-(--app-muted)">{{ v }} / {{ mx }} jobs</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-(--app-subtle)">
        <div
          class="h-full rounded-full"
          :class="v >= mx ? 'bg-(--app-warn-fg)' : 'bg-(--app-accent)'"
          :style="{ width: `${(v / mx) * 100}%` }"
        />
      </div>
    </div>
  </div>

  <!-- timeline -->
  <div v-else-if="t === 'timeline'" :class="CARD" class="p-4">
    <div class="mb-3 text-[14px] font-bold">{{ title }}</div>
    <ol class="m-0 list-none p-0">
      <li
        v-for="([who, what, when, tone], i) in timeline"
        :key="i"
        class="relative flex gap-3 pb-4 last:pb-0"
      >
        <span
          v-if="i < timeline.length - 1"
          class="absolute top-6 bottom-0 left-[11px] w-px bg-(--app-line)"
        />
        <span class="z-1 grid size-6 shrink-0 place-items-center rounded-full" :class="toneClass(tone)"
          ><Check :size="12"
        /></span>
        <span class="min-w-0 flex-1 text-[13px]">
          <b>{{ who }}</b> <span class="text-(--app-fg-2)">{{ what }}</span>
          <span class="block text-[11.5px] text-(--app-faint)">{{ when }}</span>
        </span>
      </li>
    </ol>
  </div>

  <!-- tabs -->
  <div v-else-if="t === 'tabs'" :class="CARD">
    <div class="flex gap-1 border-b border-(--app-line) px-3">
      <button
        v-for="(l, i) in tabs"
        :key="l"
        type="button"
        class="-mb-px border-b-2 px-3 py-2.5 text-[13px] font-semibold"
        :class="i === tab ? 'border-(--app-accent) text-(--app-fg)' : 'border-transparent text-(--app-muted)'"
        @click.stop="go(i, 'tab')"
      >
        {{ l }}
      </button>
    </div>
    <div class="p-4 text-[13px] text-(--app-muted)">
      {{ tabs[tab] }} — {{ str(r.panelText, 'Content for this tab.') }}
    </div>
  </div>

  <!-- steps -->
  <div v-else-if="t === 'steps'" :class="CARD" class="p-4">
    <div class="flex items-center">
      <template v-for="(l, i) in steps" :key="l">
        <div class="flex shrink-0 items-center gap-2">
          <span
            class="grid size-7 place-items-center rounded-full border-2 text-[12px] font-bold"
            :class="
              i <= step
                ? 'border-(--app-accent) bg-(--app-accent) text-(--app-accent-fg)'
                : 'border-(--app-line) text-(--app-faint)'
            "
          >
            <Check v-if="i < step" :size="13" /><template v-else>{{ i + 1 }}</template>
          </span>
          <span class="text-[12.5px] font-semibold" :class="i <= step ? '' : 'text-(--app-faint)'">{{
            l
          }}</span>
        </div>
        <span
          v-if="i < steps.length - 1"
          class="mx-2 h-0.5 min-w-4 flex-1 rounded"
          :class="i < step ? 'bg-(--app-accent)' : 'bg-(--app-line)'"
        />
      </template>
    </div>
    <div class="mt-4 flex justify-end gap-2">
      <button
        type="button"
        class="h-8 rounded-(--app-radius) border border-(--app-line) px-3 text-[12.5px] font-semibold disabled:opacity-40"
        :disabled="step === 0"
        @click.stop="go(step - 1, 'step')"
      >
        Back
      </button>
      <button
        type="button"
        class="h-8 rounded-(--app-radius) bg-(--app-accent) px-3 text-[12.5px] font-bold text-(--app-accent-fg) disabled:opacity-40"
        :disabled="step >= steps.length - 1"
        @click.stop="go(step + 1, 'step')"
      >
        Next step
      </button>
    </div>
  </div>

  <!-- alert -->
  <div v-else-if="t === 'alert'">
    <div
      v-if="!dismissed"
      class="flex items-start gap-3 rounded-(--app-radius-lg) px-4 py-3"
      :class="toneClass(alert.tone)"
    >
      <component :is="alert.icon" :size="17" class="mt-0.5 shrink-0" />
      <div class="min-w-0 flex-1 text-[13px]">
        <div class="font-bold">{{ title || 'Heads up' }}</div>
        <div v-if="r.text" class="opacity-90">{{ tr(props, 'text', str(r.text)) }}</div>
      </div>
      <button
        type="button"
        class="opacity-70 hover:opacity-100"
        aria-label="Dismiss"
        @click.stop="dismissed = true"
      >
        <X :size="14" />
      </button>
    </div>
    <button
      v-else
      type="button"
      class="text-[12px] text-(--app-faint) underline"
      @click.stop="dismissed = false"
    >
      Alert dismissed · show again
    </button>
  </div>

  <!-- pagination -->
  <div v-else class="flex flex-wrap items-center gap-3 text-[12.5px]">
    <span v-if="r.variant !== 'simple'" class="text-(--app-muted)"
      >{{ (page - 1) * size + 1 }}–{{ Math.min(page * size, total) }} of {{ total }}</span
    >
    <span v-else class="text-(--app-muted)">Page {{ page }} of {{ pages }}</span>
    <div class="ml-auto flex items-center gap-1">
      <button
        type="button"
        class="grid size-8 place-items-center rounded-(--app-radius) border border-(--app-line) disabled:opacity-40"
        :disabled="page === 1"
        aria-label="Previous page"
        @click.stop="goPage(page - 1)"
      >
        <ChevronLeft :size="14" />
      </button>
      <template v-if="r.variant !== 'simple'">
        <template v-for="(n, i) in nums" :key="i">
          <span v-if="n === null" class="px-1 text-(--app-faint)">…</span>
          <button
            v-else
            type="button"
            class="h-8 min-w-8 rounded-(--app-radius) border px-2 font-semibold"
            :class="
              n === page
                ? 'border-(--app-accent) bg-(--app-accent) text-(--app-accent-fg)'
                : 'border-(--app-line)'
            "
            @click.stop="goPage(n)"
          >
            {{ n }}
          </button>
        </template>
      </template>
      <button
        type="button"
        class="grid size-8 place-items-center rounded-(--app-radius) border border-(--app-line) disabled:opacity-40"
        :disabled="page === pages"
        aria-label="Next page"
        @click.stop="goPage(page + 1)"
      >
        <ChevronRight :size="14" />
      </button>
      <select
        v-if="r.variant !== 'simple'"
        v-model.number="size"
        class="ml-2 h-8 rounded-(--app-radius) border border-(--app-line) bg-(--app-surface) px-2"
        @click.stop
      >
        <option v-for="s in [10, 25, 50]" :key="s" :value="s">{{ s }} / page</option>
      </select>
    </div>
  </div>
</template>
