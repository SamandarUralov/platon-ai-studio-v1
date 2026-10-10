<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { PTypingDots } from '@platon/ui'
import { QUESTIONS } from '../catalog'
import { useFlow } from '../flow'
import { useAnswerText } from '../useAnswerText'
import AiMessage from './feed/AiMessage.vue'
import AnalysisCard from './feed/AnalysisCard.vue'
import BriefCard from './feed/BriefCard.vue'
import BuildProgress from './feed/BuildProgress.vue'
import QaRow from './feed/QaRow.vue'
import SummaryCard from './feed/SummaryCard.vue'
import UserMessage from './feed/UserMessage.vue'

const flow = useFlow()
const { t, summarize, questionText } = useAnswerText(flow)
const s = flow.state
const scroller = ref<HTMLElement | null>(null)

const hasIntro = computed(() => s.msgs.some((m) => m.kind === 'intro'))
// Answered questions show as Q&A pairs, except the one currently open in the dock.
const qa = computed(() =>
  hasIntro.value
    ? QUESTIONS.flatMap((q, i) => {
        const a = s.answers[q.id]
        if (!a || (s.phase === 'q' && i === s.qi)) return []
        return [{ id: q.id, icon: q.icon, question: questionText(q.id, 'text'), answer: summarize(q.id, a) }]
      })
    : [],
)
const showSummary = computed(() => s.phase === 'summary' || flow.locked.value)

watch(
  () => [s.msgs.length, s.phase, s.qi, s.thinking, flow.answeredCount.value],
  async () => {
    await nextTick()
    // Small delay lets the dock resize first so we scroll to the real bottom.
    setTimeout(() => scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' }), 40)
  },
)
</script>

<template>
  <div ref="scroller" class="scroll-thin flex-1 overflow-auto">
    <div class="mx-auto flex max-w-[760px] flex-col gap-5 px-6 py-7" role="log" aria-live="polite">
      <template v-for="(m, i) in s.msgs" :key="i">
        <UserMessage
          v-if="m.kind === 'user'"
          class="animate-rise"
          :text="m.text || t('newProject.feed.docsOnly')"
          :files="m.files"
        />
        <AiMessage
          v-else-if="m.kind === 'analysis'"
          class="animate-rise"
          :text="
            m.files.every((f) => f.status === 'done')
              ? t('newProject.feed.readN', { n: m.files.length }, m.files.length)
              : t('newProject.feed.reading')
          "
        >
          <AnalysisCard :files="m.files" />
        </AiMessage>
        <AiMessage v-else-if="m.kind === 'brief'" class="animate-rise" :text="t('newProject.feed.briefIntro')"
          ><BriefCard
        /></AiMessage>
        <AiMessage
          v-else-if="m.kind === 'intro'"
          class="animate-rise"
          :text="t('newProject.feed.questionsIntro', { n: QUESTIONS.length })"
        />
      </template>

      <QaRow
        v-for="r in qa"
        :key="r.id"
        class="animate-rise"
        :icon="r.icon"
        :question="r.question"
        :answer="r.answer"
        :editable="!flow.locked.value"
        :edit-label="t('newProject.feed.changeAnswer')"
        @edit="flow.edit(r.id)"
      />

      <AiMessage v-if="showSummary" class="animate-rise" :text="t('newProject.feed.summaryIntro')"
        ><SummaryCard
      /></AiMessage>
      <AiMessage
        v-if="flow.locked.value"
        class="animate-rise"
        :text="s.phase === 'done' ? t('newProject.feed.done') : t('newProject.feed.building')"
      >
        <BuildProgress />
      </AiMessage>

      <div v-if="s.thinking" class="flex items-center gap-3" :aria-label="t('newProject.feed.thinking')">
        <div
          class="grid size-7 shrink-0 place-items-center rounded-[9px] bg-ink text-on-ink"
          aria-hidden="true"
        >
          <Sparkles :size="13" />
        </div>
        <PTypingDots />
      </div>
    </div>
  </div>
</template>
