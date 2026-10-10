<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, GitCompare, Play, Sparkles } from 'lucide-vue-next'
import { PButton } from '@platon/ui'
import type { AiMessage } from '@platon/definition'
import { renderMarkdown } from '../markdown'
import ChipPill from './ChipPill.vue'
import PlanCard from './PlanCard.vue'
import DiffBlock from './DiffBlock.vue'
import NamingPicker from './NamingPicker.vue'
import ComponentGen from './ComponentGen.vue'

const props = defineProps<{
  message: AiMessage
  checked?: string[]
  busy?: boolean
  streaming?: boolean
  componentExists?: boolean
}>()
defineEmits<{
  toggle: [itemId: string]
  apply: []
  discard: []
  applyDiff: []
  discardDiff: []
  pickName: [name: string]
  openComponent: [id: string]
  preview: []
  changes: []
}>()
const { t } = useI18n()
const html = computed(() =>
  props.message.role === 'assistant' && props.message.text ? renderMarkdown(props.message.text) : '',
)
</script>

<template>
  <div v-if="message.role === 'user'" class="flex max-w-[88%] flex-col items-end gap-1.5 self-end">
    <div v-if="message.chips?.length" class="flex flex-wrap justify-end gap-1">
      <ChipPill v-for="c in message.chips" :key="c.key" :chip="c" />
    </div>
    <div
      class="rounded-[12px_12px_4px_12px] bg-primary px-3 py-2.5 text-md leading-normal break-words whitespace-pre-wrap text-on-accent"
    >
      {{ message.text }}
    </div>
  </div>

  <div v-else class="flex items-start gap-2.5">
    <div class="grid size-[26px] shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
      <Sparkles :size="13" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-2.5">
      <div
        v-if="message.note"
        class="flex gap-2 rounded-[9px] bg-subtle px-3 py-2 text-sm leading-normal text-fg-2"
      >
        <Eye :size="13" class="mt-0.5 shrink-0 text-muted" /><span>{{ message.note }}</span>
      </div>
      <!-- Sanitized by renderMarkdown (markdown-it html:false + DOMPurify). -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="html" class="ai-md text-md leading-relaxed text-fg" v-html="html" />
      <span v-if="message.stopped" class="text-xs text-faint italic">{{ t('ai.stopped') }}</span>
      <NamingPicker
        v-if="message.naming"
        :naming="message.naming"
        :disabled="streaming"
        @pick="$emit('pickName', $event)"
      />
      <ComponentGen
        v-if="message.component"
        :gen="message.component"
        :can-open="!!componentExists"
        @open="$emit('openComponent', message.component.componentId)"
      />
      <DiffBlock
        v-if="message.diff"
        :diff="message.diff"
        :busy="busy"
        @apply="$emit('applyDiff')"
        @discard="$emit('discardDiff')"
      />
      <PlanCard
        v-if="message.plan"
        :plan="message.plan"
        :checked="checked ?? []"
        :busy="busy"
        @toggle="$emit('toggle', $event)"
        @apply="$emit('apply')"
        @discard="$emit('discard')"
      />
      <div v-if="message.links" class="flex flex-wrap gap-1.5">
        <PButton size="xs" :icon="Play" @click="$emit('preview')">{{ t('ai.links.preview') }}</PButton>
        <PButton size="xs" :icon="GitCompare" @click="$emit('changes')">{{ t('ai.links.changes') }}</PButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-md :deep(p) {
  margin: 0 0 0.5em;
}
.ai-md :deep(p:last-child),
.ai-md :deep(ul:last-child),
.ai-md :deep(ol:last-child) {
  margin-bottom: 0;
}
.ai-md :deep(ul),
.ai-md :deep(ol) {
  margin: 0 0 0.5em;
  padding-left: 1.25em;
}
.ai-md :deep(ul) {
  list-style: disc;
}
.ai-md :deep(ol) {
  list-style: decimal;
}
.ai-md :deep(li) {
  margin: 0.15em 0;
}
.ai-md :deep(strong) {
  font-weight: 700;
}
.ai-md :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}
.ai-md :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.88em;
  padding: 0.1em 0.35em;
  border-radius: 5px;
  background: var(--color-subtle);
}
.ai-md :deep(pre) {
  margin: 0.4em 0 0.6em;
  padding: 8px 10px;
  border-radius: 8px;
  overflow: auto;
  background: var(--color-code-bg);
  color: var(--color-code-fg);
  font-size: 11.5px;
  line-height: 1.55;
}
.ai-md :deep(pre code) {
  padding: 0;
  background: none;
  color: inherit;
}
</style>
