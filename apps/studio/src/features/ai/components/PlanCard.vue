<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ListChecks, Minus } from 'lucide-vue-next'
import { PButton, PIcon, cn, toneClasses } from '@platon/ui'
import { CHANGE_AREAS, type AiPlan } from '@platon/definition'
import { groupPlanItems } from '../plan'

const props = defineProps<{ plan: AiPlan; checked: string[]; busy?: boolean }>()
defineEmits<{ toggle: [itemId: string]; apply: []; discard: [] }>()
const { t } = useI18n()

const open = ref<Record<string, boolean>>({})
const groups = computed(() => groupPlanItems(props.plan.items))
const pending = computed(() => props.plan.status === 'pending')
const nChecked = computed(() => props.checked.length)
const nApplied = computed(() => props.plan.items.filter((i) => i.status === 'applied').length)
const statusTone = computed(() =>
  props.plan.status === 'applied'
    ? 'text-ok'
    : props.plan.status === 'discarded'
      ? 'text-faint'
      : 'text-warn',
)
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line bg-surface" :aria-label="plan.title">
    <div class="flex items-center gap-2 border-b border-line-faint px-3 py-2.5 text-sm font-bold text-fg">
      <ListChecks :size="14" class="shrink-0 text-primary" />
      <span class="min-w-0 truncate" :title="plan.title">{{ plan.title }}</span>
      <span :class="cn('ml-auto shrink-0 font-semibold', statusTone)">{{ t(`ai.plan.${plan.status}`) }}</span>
    </div>

    <div v-for="g in groups" :key="g.area">
      <div
        v-for="it in g.items"
        :key="it.id"
        :class="
          cn(
            'flex gap-2.5 border-b border-line-faint px-3 py-2.5',
            !pending && it.status === 'skipped' && 'opacity-55',
          )
        "
      >
        <button
          v-if="pending"
          type="button"
          role="checkbox"
          :aria-checked="checked.includes(it.id)"
          :aria-label="t('ai.plan.select', { title: it.title })"
          :class="
            cn(
              'mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] text-on-accent transition-colors',
              checked.includes(it.id) ? 'border-primary bg-primary' : 'border-line-2 bg-surface',
            )
          "
          @click="$emit('toggle', it.id)"
        >
          <Check v-if="checked.includes(it.id)" :size="12" :stroke-width="3" />
        </button>
        <span
          v-else-if="it.status === 'applied'"
          class="mt-px grid size-[18px] shrink-0 place-items-center rounded-full bg-ok-dot text-on-accent"
        >
          <Check :size="11" :stroke-width="3" />
        </span>
        <span
          v-else
          class="mt-px grid size-[18px] shrink-0 place-items-center rounded-full bg-subtle text-faint"
          ><Minus :size="11"
        /></span>

        <div class="min-w-0 flex-1">
          <span
            :class="
              cn(
                'mb-1 inline-flex h-[19px] items-center gap-1 rounded-[5px] px-1.5 text-2xs font-bold',
                toneClasses[CHANGE_AREAS[it.area].tone].bg,
                toneClasses[CHANGE_AREAS[it.area].tone].fg,
              )
            "
          >
            <PIcon :name="CHANGE_AREAS[it.area].icon" :size="11" />{{ it.area }}
          </span>
          <div class="text-base leading-snug font-semibold text-fg">{{ it.title }}</div>
          <div class="mt-0.5 text-sm leading-snug text-muted">{{ it.detail }}</div>
          <button
            type="button"
            class="mt-1 text-xs font-semibold text-primary hover:underline"
            :aria-expanded="!!open[it.id]"
            @click="open[it.id] = !open[it.id]"
          >
            {{ open[it.id] ? t('ai.plan.hideMeta') : t('ai.plan.showMeta') }}
          </button>
          <pre
            v-if="open[it.id]"
            class="mt-1.5 rounded-[7px] bg-code-bg px-2.5 py-2 font-mono text-2xs leading-relaxed break-words whitespace-pre-wrap text-code-fg"
            >{{ it.meta }}</pre>
        </div>
      </div>
    </div>

    <div v-if="pending" class="flex gap-2 bg-bg-home px-3 py-2.5">
      <PButton
        variant="primary"
        size="md"
        class="flex-1"
        :disabled="!nChecked"
        :loading="busy"
        @click="$emit('apply')"
      >
        {{ t('ai.plan.apply', nChecked) }}
      </PButton>
      <PButton variant="outline" size="md" :disabled="busy" @click="$emit('discard')">{{
        t('ai.plan.discard')
      }}</PButton>
    </div>
    <div
      v-else-if="plan.status === 'applied'"
      class="flex items-center gap-1.5 bg-ok-bg/60 px-3 py-2 text-xs font-semibold text-ok"
      role="status"
    >
      <Check :size="13" />{{ t('ai.plan.appliedNote', nApplied) }}
    </div>
    <div v-else class="bg-bg-home px-3 py-2 text-xs text-muted" role="status">
      {{ t('ai.plan.discardedNote') }}
    </div>
  </div>
</template>
