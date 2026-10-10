<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles } from 'lucide-vue-next'
import { PTypingDots } from '@platon/ui'
import type { AiMessage } from '@platon/definition'
import type { Template } from '../skills'
import MessageBubble from './MessageBubble.vue'

const props = defineProps<{
  messages: AiMessage[]
  thinking: boolean
  streaming: boolean
  checked: Record<string, string[]>
  busy: Record<string, boolean>
  suggestions: Template[]
  componentIds: ReadonlySet<string>
}>()
defineEmits<{
  toggle: [messageId: string, itemId: string]
  apply: [messageId: string]
  discard: [messageId: string]
  applyDiff: [messageId: string, apply: boolean]
  pickName: [messageId: string, name: string]
  openComponent: [id: string]
  suggest: [prompt: string]
  preview: []
  changes: []
}>()
const { t } = useI18n()
const el = ref<HTMLElement>()

// Follow the stream only while the user is near the bottom, so reading older messages isn't interrupted.
let stick = true
function onScroll() {
  const e = el.value
  if (e) stick = e.scrollHeight - e.scrollTop - e.clientHeight < 80
}
watch(
  () => [
    props.messages.length,
    props.messages.at(-1)?.text.length,
    props.messages.at(-1)?.plan?.id,
    props.thinking,
  ],
  async (_n, o) => {
    if (o?.[0] !== props.messages.length) stick = true
    await nextTick()
    if (stick && el.value) el.value.scrollTop = el.value.scrollHeight
  },
  { immediate: true },
)

const isEmptyDraft = (m: AiMessage) =>
  m.role === 'assistant' && !m.text && !m.note && !m.plan && !m.diff && !m.naming && !m.component
</script>

<template>
  <div
    ref="el"
    class="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto bg-bg-home p-4 scroll-thin"
    aria-live="polite"
    @scroll.passive="onScroll"
  >
    <div v-if="!messages.length" class="flex flex-col gap-1 pt-2 pl-[35px]">
      <div class="text-md font-bold text-fg">{{ t('ai.emptyTitle') }}</div>
      <div class="text-sm text-muted">{{ t('ai.emptyLead') }}</div>
    </div>
    <template v-for="m in messages" :key="m.id">
      <MessageBubble
        v-if="!isEmptyDraft(m)"
        :message="m"
        :checked="m.plan ? checked[m.plan.id] : undefined"
        :busy="!!(m.plan && busy[m.plan.id]) || !!(m.diff && busy[m.diff.id])"
        :streaming="streaming"
        :component-exists="!!m.component && componentIds.has(m.component.componentId)"
        class="animate-rise"
        @toggle="$emit('toggle', m.id, $event)"
        @apply="$emit('apply', m.id)"
        @discard="$emit('discard', m.id)"
        @apply-diff="$emit('applyDiff', m.id, true)"
        @discard-diff="$emit('applyDiff', m.id, false)"
        @pick-name="$emit('pickName', m.id, $event)"
        @open-component="$emit('openComponent', $event)"
        @preview="$emit('preview')"
        @changes="$emit('changes')"
      />
    </template>
    <div v-if="thinking" class="flex items-center gap-2.5" role="status">
      <div class="grid size-[26px] place-items-center rounded-lg bg-primary-tint text-primary">
        <Sparkles :size="13" />
      </div>
      <span class="text-sm text-muted">{{ t('ai.thinking') }}</span>
      <PTypingDots />
    </div>
    <div v-if="!messages.length && suggestions.length" class="flex flex-col gap-1.5 pl-[35px]">
      <button
        v-for="s in suggestions"
        :key="s.label"
        type="button"
        class="rounded-[9px] border border-line bg-surface px-3 py-2 text-left text-sm leading-snug font-medium text-primary-strong transition-colors hover:border-primary-ring hover:bg-primary-tint/40"
        @click="$emit('suggest', s.prompt)"
      >
        {{ s.prompt }}
      </button>
    </div>
  </div>
</template>
