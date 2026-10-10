<script setup lang="ts">
/** Changes grouped by area, in plain language or as the JSON Patch ops behind them. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowUpRight, Sparkles } from 'lucide-vue-next'
import { CHANGE_AREAS, groupByArea, type Change, type PatchOp } from '@platon/definition'
import { PAvatar, PIcon, toneClasses } from '@platon/ui'
import { useDefinitionStore } from '@/stores/definition'
import { relTime } from '@/composables/format'
import { changePointer, linkForPointer } from '@/composables/definitionLinks'

const props = defineProps<{ changes: Change[]; mode: 'plain' | 'definition'; projectId: string }>()
const { t } = useI18n()
const router = useRouter()
const def = useDefinitionStore()

const groups = computed(() => groupByArea(props.changes))

function target(c: Change) {
  return linkForPointer(props.projectId, changePointer(c), def.definition)
}

const OP_CLASS: Record<PatchOp['op'], string> = {
  add: 'text-ok',
  remove: 'text-danger',
  replace: 'text-warn',
  move: 'text-info',
  copy: 'text-info',
  test: 'text-muted',
}

function preview(v: unknown): string {
  if (v === undefined) return ''
  const s = JSON.stringify(v)
  return s.length > 140 ? `${s.slice(0, 139)}…` : s
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <section
      v-for="[area, list] in groups"
      :key="area"
      class="overflow-hidden rounded-xl border border-line-2 bg-surface"
    >
      <header class="flex items-center gap-2 border-b border-line-faint px-4 py-2.5">
        <span
          class="inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs font-bold"
          :class="[toneClasses[CHANGE_AREAS[area].tone].bg, toneClasses[CHANGE_AREAS[area].tone].fg]"
        >
          <PIcon :name="CHANGE_AREAS[area].icon" :size="12" />{{ t(`releases.area.${area}`) }}
        </span>
        <span class="text-xs text-faint">{{
          t('releases.changeCount', { n: list.length }, list.length)
        }}</span>
      </header>
      <ul class="m-0 list-none p-0">
        <li
          v-for="c in list"
          :key="c.id"
          class="group flex items-start gap-3 border-b border-line-faint px-4 py-2.5 last:border-b-0"
        >
          <span
            v-if="c.authorKind === 'ai'"
            class="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-md bg-ai-bg text-ai"
            :title="t('releases.byAi')"
          >
            <Sparkles :size="12" />
          </span>
          <PAvatar v-else :name="c.author" :size="22" class="mt-0.5" :title="c.author" />
          <div class="min-w-0 flex-1">
            <template v-if="mode === 'plain'">
              <div class="text-md">{{ c.text }}</div>
              <div class="mt-0.5 truncate font-mono text-2xs text-faint" :title="c.machinePath">
                {{ c.machinePath }}
              </div>
            </template>
            <template v-else>
              <div class="font-mono text-xs text-muted">{{ c.machinePath }}</div>
              <div v-if="!c.ops.length" class="mt-1 text-xs italic text-faint">{{ t('releases.noOps') }}</div>
              <div
                v-for="(op, i) in c.ops"
                :key="i"
                class="mt-1 break-all rounded-md bg-subtle px-2 py-1 font-mono text-xs"
              >
                <span class="font-bold uppercase" :class="OP_CLASS[op.op]">{{ op.op }}</span>
                <span class="ml-2 text-fg">{{ op.path }}</span>
                <span v-if="op.from" class="text-faint"> ← {{ op.from }}</span>
                <span v-if="op.value !== undefined" class="block text-muted">{{ preview(op.value) }}</span>
              </div>
            </template>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <span class="whitespace-nowrap text-xs text-faint" :title="c.createdAt"
              >{{ c.author }} · {{ relTime(c.createdAt) }}</span
            >
            <button
              v-if="target(c)"
              type="button"
              class="inline-flex items-center gap-0.5 rounded px-1 text-2xs font-semibold text-primary-strong opacity-0 hover:bg-primary-tint focus-visible:opacity-100 group-hover:opacity-100"
              @click="router.push(target(c)!.to)"
            >
              {{ t('releases.openIn', { layer: target(c)!.layer }) }}<ArrowUpRight :size="11" />
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
