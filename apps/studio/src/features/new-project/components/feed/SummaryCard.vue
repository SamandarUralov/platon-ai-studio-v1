<script setup lang="ts">
import { computed } from 'vue'
import { Pencil } from 'lucide-vue-next'
import { PIcon } from '@platon/ui'
import { BLUEPRINT, QUESTIONS } from '../../catalog'
import { useFlow } from '../../flow'
import { useAnswerText } from '../../useAnswerText'

const flow = useFlow()
const { t, summarize, questionText } = useAnswerText(flow)
const s = flow.state

const initial = computed(() => (s.name.trim() || s.brief?.name || 'A').charAt(0).toUpperCase())
const langs = computed(() => {
  const v = flow.value('langs').sel.v
  return Array.isArray(v) ? v.length : 0
})
const stats = computed(() => [
  { v: BLUEPRINT.pages.length, l: t('newProject.summary.pages') },
  { v: BLUEPRINT.tables.length, l: t('newProject.summary.tables') },
  { v: BLUEPRINT.roles.length, l: t('newProject.summary.roles') },
  { v: langs.value, l: t('newProject.summary.languages') },
])
const rows = computed(() =>
  QUESTIONS.map((q) => ({
    id: q.id,
    icon: q.icon,
    label: questionText(q.id, 'label'),
    value: summarize(q.id, s.answers[q.id] ?? flow.value(q.id)),
  })),
)
</script>

<template>
  <div class="overflow-hidden rounded-[18px] border border-line bg-surface shadow-card">
    <!-- Tint is derived from the user's brand colour, so it is computed inline rather than a token. -->
    <div
      class="flex items-center gap-4 px-[22px] pb-[18px] pt-[22px]"
      :style="{ background: `color-mix(in srgb, ${flow.theme.value.hex} 9%, var(--p-surface))` }"
    >
      <div
        class="grid size-[52px] shrink-0 place-items-center rounded-[15px] text-[22px] font-extrabold text-white"
        :style="{ background: flow.theme.value.hex }"
      >
        {{ initial }}
      </div>
      <div class="min-w-0 flex-1">
        <input
          v-model="s.name"
          :readonly="flow.locked.value"
          :aria-label="t('newProject.summary.name')"
          maxlength="60"
          :class="[
            '-mx-1.5 w-[calc(100%+12px)] rounded-lg bg-transparent px-1.5 text-[22px] font-extrabold tracking-[-0.02em] outline-none',
            flow.locked.value ? 'cursor-default' : 'hover:bg-surface/60 focus:bg-surface focus:shadow-focus',
          ]"
        />
        <div class="mt-[3px] text-md leading-snug text-fg-2">{{ s.brief?.tagline }}</div>
      </div>
    </div>
    <div class="grid grid-cols-4 border-y border-line-faint">
      <div
        v-for="st in stats"
        :key="st.l"
        class="border-r border-line-faint px-[18px] py-3.5 last:border-r-0"
      >
        <div class="text-[22px] font-extrabold">{{ st.v }}</div>
        <div class="text-sm font-semibold text-faint">{{ st.l }}</div>
      </div>
    </div>
    <div class="flex flex-col gap-3 border-b border-line-faint px-[22px] py-4">
      <div class="flex gap-3.5">
        <div class="w-[70px] shrink-0 pt-[5px] text-sm font-bold text-faint">
          {{ t('newProject.summary.pages') }}
        </div>
        <div class="flex flex-wrap gap-[5px]">
          <span
            v-for="p in BLUEPRINT.pages"
            :key="p"
            class="inline-flex h-[26px] items-center rounded-[7px] bg-subtle px-2.5 text-sm font-semibold text-fg-2"
            >{{ p }}</span
          >
        </div>
      </div>
      <div class="flex gap-3.5">
        <div class="w-[70px] shrink-0 pt-[5px] text-sm font-bold text-faint">
          {{ t('newProject.summary.tables') }}
        </div>
        <div class="flex flex-wrap gap-[5px]">
          <span
            v-for="p in BLUEPRINT.tables"
            :key="p"
            class="inline-flex h-[26px] items-center rounded-[7px] bg-subtle px-2.5 font-mono text-sm text-fg-2"
            >{{ p }}</span
          >
        </div>
      </div>
    </div>
    <div class="grid grid-cols-2 px-3 pb-2.5 pt-1.5">
      <button
        v-for="r in rows"
        :key="r.id"
        type="button"
        :disabled="flow.locked.value"
        :aria-label="t('newProject.summary.edit', { label: r.label })"
        class="group flex items-start gap-[11px] rounded-[10px] p-2.5 text-left enabled:hover:bg-subtle-2 disabled:cursor-default"
        @click="flow.edit(r.id)"
      >
        <PIcon :name="r.icon" :size="15" class="mt-0.5 shrink-0 text-primary" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-faint">{{ r.label }}</span>
          <span class="mt-0.5 block text-md leading-snug">{{ r.value }}</span>
        </span>
        <Pencil
          v-if="!flow.locked.value"
          :size="13"
          class="mt-[3px] shrink-0 text-faint-2"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>
