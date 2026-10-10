<script setup lang="ts">
/** Who sends (auto from MQ produce layers) → queue → consumers (drag functions here to attach). */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowRight, Inbox, RotateCcw, Skull, X } from 'lucide-vue-next'
import {
  formatType,
  LOGIC_KINDS,
  walkSteps,
  type LogicKind,
  type Queue,
  type QueueMessage,
  type Step,
} from '@platon/definition'
import { cn, PButton, PIcon, PSelect, toneClasses } from '@platon/ui'
import { useDefinitionStore } from '@/stores/definition'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useLogicEditor } from '../../store'
import { apiLabel } from '../../lib/apis'

const props = defineProps<{ queue: Queue; messages: QueueMessage[]; replaying: boolean }>()
const emit = defineEmits<{ edit: [fn: (q: Queue) => Queue]; replayAll: [] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const ed = useLogicEditor()
const router = useRouter()
const pid = useProjectId()

const producers = computed(() => {
  const d = def.definition
  if (!d) return []
  const out: { kind: LogicKind; id: string; name: string; sub: string }[] = []
  const has = (steps: Step[]) => {
    let hit = false
    walkSteps(steps, (s) => {
      if (s.type === 'produce' && (s.config.queue === props.queue.id || s.config.queue === props.queue.name))
        hit = true
    })
    return hit
  }
  for (const f of d.logic.functions)
    if (has(f.steps))
      out.push({ kind: 'functions', id: f.id, name: f.name, sub: t('logic.queue.fnProducer') })
  for (const a of d.logic.apis)
    if (has(a.steps))
      out.push({ kind: 'apis', id: a.id, name: `${apiLabel(a).badge} ${apiLabel(a).text}`, sub: 'API' })
  for (const c of d.logic.crons)
    if (has(c.steps)) out.push({ kind: 'crons', id: c.id, name: c.name, sub: 'Cron' })
  return out
})

const fnByName = computed(() => new Map((def.definition?.logic.functions ?? []).map((f) => [f.name, f])))
const attachable = computed(() =>
  (def.definition?.logic.functions ?? [])
    .filter((f) => !props.queue.consumers.includes(f.name))
    .map((f) => ({ value: f.name, label: f.name })),
)
const waiting = computed(
  () => props.messages.filter((m) => m.status === 'waiting' || m.status === 'retrying').length,
)
const dead = computed(() => props.messages.filter((m) => m.status === 'dead').length)

function attach(name: string | undefined) {
  if (!name || props.queue.consumers.includes(name)) return
  emit('edit', (q) => ({ ...q, consumers: [...q.consumers, name] }))
}
function detach(name: string) {
  emit('edit', (q) => ({ ...q, consumers: q.consumers.filter((c) => c !== name) }))
}

const over = ref(false)
const accepts = computed(() => ed.drag?.kind === 'item' && ed.drag.itemKind === 'functions')
function onDrop(e: DragEvent) {
  e.preventDefault()
  over.value = false
  const d = ed.drag
  ed.drag = null
  if (d?.kind === 'item' && d.itemKind === 'functions')
    attach(def.definition?.logic.functions.find((f) => f.id === d.id)?.name)
}
const go = (kind: LogicKind, id: string) => router.push(projectLinks(pid.value).logic(kind, id))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-3">
      <!-- producers -->
      <div class="flex flex-col gap-2">
        <div class="eyebrow">{{ t('logic.queue.publishedBy') }}</div>
        <button
          v-for="p in producers"
          :key="`${p.kind}/${p.id}`"
          type="button"
          class="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 text-left shadow-xs hover:border-primary-ring"
          @click="go(p.kind, p.id)"
        >
          <span
            :class="
              cn(
                'grid size-7 shrink-0 place-items-center rounded-lg',
                toneClasses[LOGIC_KINDS[p.kind].tone].bg,
                toneClasses[LOGIC_KINDS[p.kind].tone].fg,
              )
            "
            ><PIcon :name="LOGIC_KINDS[p.kind].icon" :size="14"
          /></span>
          <span class="min-w-0"
            ><span class="block truncate font-mono text-sm font-semibold">{{ p.name }}</span
            ><span class="block text-xs text-faint">{{ p.sub }}</span></span
          >
        </button>
        <p
          v-if="!producers.length"
          class="rounded-xl border border-dashed border-line p-3 text-sm text-faint"
        >
          {{ t('logic.queue.noProducers') }}
        </p>
      </div>
      <ArrowRight :size="18" class="mt-10 text-faint" />

      <!-- queue -->
      <div class="flex flex-col gap-2">
        <div class="eyebrow">{{ t('logic.queue.queue') }}</div>
        <div class="rounded-xl border border-purple/30 bg-surface p-3 shadow-card">
          <div class="flex items-center gap-2">
            <span class="grid size-7 place-items-center rounded-lg bg-purple-bg text-purple"
              ><Inbox :size="14"
            /></span>
            <span class="min-w-0 flex-1 truncate font-mono text-md font-bold">{{ queue.name }}</span>
          </div>
          <div class="mt-1 text-xs text-muted">{{ t('logic.queue.waiting', { n: waiting }) }}</div>
          <div class="mt-2 flex flex-wrap gap-1">
            <span
              v-for="f in queue.fields"
              :key="f.name"
              class="rounded-md bg-subtle px-1.5 py-0.5 font-mono text-2xs text-fg-2"
              >{{ f.name }}{{ f.req ? '' : '?' }}: {{ formatType(f.type, f.fields) }}</span
            >
          </div>
        </div>
      </div>
      <ArrowRight :size="18" class="mt-10 text-faint" />

      <!-- consumers -->
      <div class="flex flex-col gap-2">
        <div class="eyebrow">{{ t('logic.queue.processedBy') }}</div>
        <div
          v-for="c in queue.consumers"
          :key="c"
          class="group flex items-center gap-2 rounded-xl border bg-surface p-2.5 shadow-xs"
          :class="fnByName.has(c) ? 'border-line' : 'border-danger/40'"
        >
          <span class="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary-strong"
            ><PIcon name="braces" :size="14"
          /></span>
          <button
            type="button"
            class="min-w-0 flex-1 text-left"
            @click="fnByName.get(c) && go('functions', fnByName.get(c)!.id)"
          >
            <span class="block truncate font-mono text-sm font-semibold">{{ c }}</span>
            <span class="block text-xs" :class="fnByName.has(c) ? 'text-faint' : 'text-danger'">{{
              fnByName.has(c)
                ? t('logic.queue.consumer', { n: queue.settings.concurrency })
                : t('logic.queue.missingFn')
            }}</span>
          </button>
          <button
            type="button"
            class="grid size-6 place-items-center rounded-md text-faint hover:bg-danger-bg hover:text-danger"
            :title="t('logic.queue.detach')"
            @click="detach(c)"
          >
            <X :size="13" />
          </button>
        </div>
        <div
          :class="
            cn(
              'rounded-xl border-[1.5px] border-dashed p-3 text-center text-sm',
              over
                ? 'border-primary bg-primary-tint text-primary-strong'
                : accepts
                  ? 'border-primary-ring text-primary-strong'
                  : 'border-line text-faint',
            )
          "
          @dragover="accepts && ($event.preventDefault(), (over = true))"
          @dragleave="over = false"
          @drop="onDrop"
        >
          {{ t('logic.queue.dropFn') }}
        </div>
        <PSelect
          size="sm"
          :model-value="undefined"
          :options="attachable"
          :placeholder="t('logic.queue.attach')"
          @update:model-value="attach"
        />
      </div>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <Skull :size="16" :class="dead ? 'text-danger' : 'text-faint'" />
      <div class="min-w-0 flex-1">
        <div class="text-md font-semibold">
          {{ dead ? t('logic.queue.deadCount', dead) : t('logic.queue.noDead') }}
        </div>
        <div class="text-xs text-muted">
          {{ t('logic.queue.retryText', { n: queue.settings.retries, backoff: queue.settings.backoff }) }}
        </div>
      </div>
      <PButton v-if="dead" :icon="RotateCcw" :loading="replaying" @click="emit('replayAll')">{{
        t('logic.queue.replayAll')
      }}</PButton>
    </div>
  </div>
</template>
