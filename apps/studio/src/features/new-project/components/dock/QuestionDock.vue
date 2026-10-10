<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ArrowRight, Check, PenLine } from 'lucide-vue-next'
import { PButton, PKbd, cn } from '@platon/ui'
import { useSessionStore } from '@/stores/session'
import { QUESTIONS } from '../../catalog'
import { useFlow } from '../../flow'
import { useAnswerText } from '../../useAnswerText'
import ChipOptions from '../options/ChipOptions.vue'
import EngineOptions from '../options/EngineOptions.vue'
import ListOptions from '../options/ListOptions.vue'
import MemberPicker from '../options/MemberPicker.vue'
import SwatchOptions from '../options/SwatchOptions.vue'

const flow = useFlow()
const session = useSessionStore()
const { t, ackText, questionText } = useAnswerText(flow)
const s = flow.state
const q = flow.question

const org = computed(() => session.session?.organization.name ?? '')
const groupLabel = (key: string, fallback: string) =>
  q.value.groups.length > 1 ? t(`newProject.group.${key}`) : fallback
const nextLabel = computed(() =>
  s.editing
    ? t('newProject.dock.save')
    : s.qi === QUESTIONS.length - 1
      ? t('newProject.dock.review')
      : t('newProject.dock.next'),
)
const segs = computed(() =>
  QUESTIONS.map((x, i) => (i === s.qi ? 'bg-primary' : s.answers[x.id] ? 'bg-ink' : 'bg-line-2')),
)
</script>

<template>
  <section :aria-labelledby="'np-q-' + q.id">
    <div class="flex items-center gap-2.5 px-5 pt-4">
      <span class="shrink-0 whitespace-nowrap text-sm font-bold text-primary">{{
        t('newProject.dock.questionOf', { n: s.qi + 1, total: QUESTIONS.length })
      }}</span>
      <div class="ml-auto flex max-w-[220px] flex-1 gap-1" aria-hidden="true">
        <span v-for="(c, i) in segs" :key="i" :class="cn('h-1 flex-1 rounded-sm', c)" />
      </div>
    </div>
    <div class="px-5 pt-2.5">
      <div
        v-if="s.ack"
        class="mb-1.5 flex items-center gap-1.5 text-base font-semibold text-teal"
        role="status"
      >
        <Check :size="13" aria-hidden="true" />{{ ackText(s.ack) }}
      </div>
      <h2 :id="'np-q-' + q.id" class="text-[19px] font-bold leading-tight tracking-[-0.015em]">
        {{ questionText(q.id, 'text') }}
      </h2>
      <p class="mt-1 text-base leading-snug text-faint">{{ questionText(q.id, 'hint', { org }) }}</p>
    </div>
    <div class="scroll-thin flex max-h-[44vh] flex-col gap-4 overflow-auto px-5 pb-1 pt-3.5">
      <div v-for="(g, gi) in q.groups" :key="g.key" class="flex flex-col gap-2">
        <div v-if="g.labelled" class="flex gap-1.5 text-sm font-bold text-muted">
          {{ t(`newProject.group.${g.key}`)
          }}<span v-if="g.multi" class="font-medium text-faint-2">{{ t('newProject.dock.pickAny') }}</span>
        </div>
        <ListOptions
          v-if="g.kind === 'list'"
          :group="g"
          :numbered="gi === 0"
          :label="groupLabel(g.key, questionText(q.id, 'text'))"
        />
        <ChipOptions
          v-else-if="g.kind === 'chips'"
          :group="g"
          :label="groupLabel(g.key, questionText(q.id, 'text'))"
        />
        <SwatchOptions
          v-else-if="g.kind === 'swatch'"
          :group="g"
          :label="groupLabel(g.key, questionText(q.id, 'text'))"
        />
        <EngineOptions
          v-else-if="g.kind === 'engine'"
          :group="g"
          :label="groupLabel(g.key, questionText(q.id, 'text'))"
        />
        <MemberPicker v-else-if="g.kind === 'member'" />
      </div>
      <div class="relative">
        <PenLine
          :size="15"
          class="pointer-events-none absolute left-[13px] top-[13px] text-faint-2"
          aria-hidden="true"
        />
        <input
          v-model="s.custom"
          :placeholder="t('newProject.dock.ownWords')"
          :aria-label="t('newProject.dock.ownWords')"
          class="h-[42px] w-full rounded-[11px] border border-line bg-subtle-2 pl-[38px] pr-3.5 text-lg outline-none placeholder:text-faint-2 focus:border-primary focus:bg-surface focus:shadow-focus"
        />
      </div>
    </div>
    <div class="mt-3 flex items-center gap-2 border-t border-line-faint px-5 pb-4 pt-3.5">
      <PButton size="lg" :icon="ArrowLeft" @click="flow.back">{{ t('newProject.dock.back') }}</PButton>
      <PButton variant="ghost" size="lg" class="text-muted hover:text-fg" @click="flow.skip">{{
        t('newProject.dock.skip')
      }}</PButton>
      <span class="ml-auto flex items-center gap-[5px] text-sm text-faint-2"
        ><PKbd>Enter</PKbd>{{ t('newProject.dock.toContinue') }}</span
      >
      <PButton
        variant="primary"
        size="lg"
        :icon-right="ArrowRight"
        :disabled="!flow.valid.value"
        @click="flow.next"
        >{{ nextLabel }}</PButton
      >
    </div>
  </section>
</template>
