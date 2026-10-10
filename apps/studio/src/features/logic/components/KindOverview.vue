<script setup lang="ts">
/** Group overview when no item is open: what the group is for, its items and a create button. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import { LOGIC_KINDS, type Api, type LogicKind, type LogicStatsResponse } from '@platon/definition'
import { cn, PButton, PStatusDot, toneClasses } from '@platon/ui'
import { problemsUnder } from '@platon/validators'
import { useDefinitionStore } from '@/stores/definition'
import { apiLabel } from '../lib/apis'
import { itemTitle } from '../lib/items'
import type { LogicItem } from '../lib/nav'
import { itemStatus } from '../lib/status'
import ToneTile from './ToneTile.vue'

const props = defineProps<{ kind: LogicKind; stats: LogicStatsResponse | undefined }>()
const emit = defineEmits<{ open: [id: string]; create: [] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const meta = computed(() => LOGIC_KINDS[props.kind])
const items = computed(() =>
  ((def.definition?.logic[props.kind] ?? []) as LogicItem[]).map((it) => ({
    it,
    status: itemStatus(
      props.kind,
      it,
      problemsUnder(def.problems, `/logic/${props.kind}/${it.id}`),
      props.stats,
    ),
    api: props.kind === 'apis' ? apiLabel(it as Api) : null,
  })),
)
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto scroll-thin">
    <div class="mx-auto max-w-[900px] px-6 py-8">
      <div class="mb-6 flex items-start gap-4">
        <ToneTile :icon="meta.icon" :tone="meta.tone" size="lg" />
        <div class="min-w-0 flex-1">
          <h1 class="m-0 text-[22px] font-extrabold">{{ t(`logic.kinds.${kind}`) }}</h1>
          <p class="m-0 mt-1 text-base text-muted">{{ meta.hint }}</p>
        </div>
        <PButton variant="primary" :icon="Plus" @click="emit('create')">{{ meta.create }}</PButton>
      </div>
      <div class="grid gap-2.5 sm:grid-cols-2">
        <button
          v-for="x in items"
          :key="x.it.id"
          type="button"
          class="flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-left shadow-xs hover:border-primary-ring hover:shadow-card"
          @click="emit('open', x.it.id)"
        >
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1.5">
              <span
                v-if="x.api"
                :class="
                  cn(
                    'rounded px-1 font-mono text-2xs font-bold',
                    toneClasses[x.api.tone].bg,
                    toneClasses[x.api.tone].fg,
                  )
                "
                >{{ x.api.badge }}</span
              >
              <span class="truncate text-md font-bold" :class="kind !== 'crons' && 'font-mono'">{{
                x.api ? x.api.text : itemTitle(kind, x.it)
              }}</span>
            </span>
            <span class="mt-0.5 block truncate font-mono text-xs text-faint"
              >logic.{{ kind }}.{{ x.it.id }}</span
            >
          </span>
          <span
            class="flex items-center gap-1.5 text-xs font-semibold"
            :class="toneClasses[x.status.tone].fg"
          >
            <PStatusDot :tone="x.status.tone" />{{
              t(`logic.status.${x.status.key}`, { n: x.status.count ?? 0 })
            }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
