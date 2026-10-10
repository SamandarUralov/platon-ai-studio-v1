<script setup lang="ts">
/**
 * Agent.md: project instructions Studio AI reads before every request. Markdown editor (Monaco) with a
 * sanitised preview (markdown-it + DOMPurify, never raw HTML), section snippets and ⌘S save.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave } from 'vue-router'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { FileText, Plus, Sparkles, WandSparkles } from 'lucide-vue-next'
import { PButton, PCodeEditor, PSegmented, PSpinner, cn, type SegmentOption } from '@platon/ui'
import type { AgentDoc } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'
import { relTime } from '@/composables/format'
import { http } from '@/services/http'
import SettingsCard from '../components/SettingsCard.vue'
import { settingsKeys, useAgentDoc, useResourceMutation } from '../api'
import { AGENT_SNIPPETS } from '../catalog'

const { t } = useI18n()
const pid = useProjectId()
const def = useDefinitionStore()
const doc = useAgentDoc(pid)

const text = ref('')
const saved = ref('')
watch(
  () => doc.data.value?.content,
  (c) => {
    if (c === undefined) return
    // Don't clobber local edits when the query refetches.
    if (text.value === saved.value) text.value = c
    saved.value = c
  },
  { immediate: true },
)
const dirty = computed(() => text.value !== saved.value)

const save = useResourceMutation(
  () => settingsKeys.agent(pid.value),
  async (content: string) => (await http.put<AgentDoc>(`/projects/${pid.value}/agent`, { content })).data,
  {
    success: () => t('settings.agent.saved'),
  },
)
function doSave() {
  if (dirty.value && !save.isPending.value) save.mutate(text.value)
}

onBeforeRouteLeave(() => (dirty.value ? window.confirm(t('settings.agent.leave')) : true))

type Tab = 'edit' | 'preview'
const tab = ref<Tab>('edit')
const tabs = computed<SegmentOption<Tab>[]>(() => [
  { value: 'edit', label: t('settings.agent.edit') },
  { value: 'preview', label: t('settings.agent.preview') },
])

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })
const html = computed(() => DOMPurify.sanitize(md.render(text.value)))
const tokens = computed(() => Math.ceil(text.value.length / 3.6))

function append(snippet: string) {
  text.value = `${text.value.replace(/\s*$/, '')}\n\n${snippet}\n`
  tab.value = 'edit'
}

/** Offline starter rules drafted from the definition (no AI call, nothing leaves the browser). */
function draftFromApp() {
  const d = def.definition!
  const lines = [
    '## Draft from this app',
    `- Roles: ${d.roles.map((r) => `${r.name} (${r.description ?? r.permissions.length + ' permissions'})`).join(', ')}.`,
    `- Main tables: ${d.data.tables
      .slice(0, 6)
      .map((x) => x.name)
      .join(', ')}.`,
    ...d.workflows.map((w) => `- ${w.name} moves through: ${w.states.map((s) => s.name).join(' → ')}.`),
    `- Default language is ${d.settings.defaultLanguage}; also translate into ${d.settings.languages.filter((l) => l !== d.settings.defaultLanguage).join(', ') || 'no other language'}.`,
  ]
  append(lines.join('\n'))
}
</script>

<template>
  <div v-if="doc.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <div v-else class="grid grid-cols-[minmax(0,1fr)_260px] items-start gap-4 max-[1100px]:grid-cols-1">
    <SettingsCard class="min-w-0">
      <div class="flex flex-wrap items-center gap-2.5 border-b border-line-faint py-2.5 pl-4 pr-3">
        <FileText :size="15" class="text-muted" />
        <span class="font-mono text-base font-semibold">Agent.md</span>
        <span
          :class="
            cn('inline-flex items-center gap-1.5 text-xs font-semibold', dirty ? 'text-warn' : 'text-ok')
          "
        >
          <span :class="cn('size-1.5 rounded-full', dirty ? 'bg-warn-dot' : 'bg-ok-dot')" />
          {{ dirty ? t('settings.agent.unsaved') : t('settings.agent.savedState') }}
        </span>
        <span v-if="doc.data.value && !dirty" class="text-xs text-faint"
          >·
          {{
            t('settings.agent.updated', {
              who: doc.data.value.updatedBy,
              when: relTime(doc.data.value.updatedAt),
            })
          }}</span
        >
        <PSegmented v-model="tab" :options="tabs" class="ml-auto" :aria-label="t('settings.agent.mode')" />
        <PButton
          variant="primary"
          size="sm"
          :disabled="!dirty"
          :loading="save.isPending.value"
          @click="doSave"
          >{{ t('settings.agent.save') }}</PButton
        >
      </div>
      <div v-show="tab === 'edit'" class="h-[520px]">
        <PCodeEditor
          v-model="text"
          language="markdown"
          path="Agent.md"
          :line-numbers="false"
          @save="doSave"
        />
      </div>
      <!-- Sanitised by DOMPurify; markdown-it runs with html: false. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-if="tab === 'preview'"
        class="agent-md min-h-[520px] px-6 pb-7 pt-5 text-md leading-relaxed text-fg-2"
        v-html="html"
      />
    </SettingsCard>

    <aside class="flex flex-col gap-3">
      <div
        class="rounded-[14px] border border-primary-ring/60 bg-primary-tint/50 px-4 py-3.5 text-sm leading-normal text-fg-2"
      >
        <div class="mb-1.5 flex items-center gap-1.5 font-bold text-fg">
          <Sparkles :size="14" class="text-primary" />{{ t('settings.agent.howTitle') }}
        </div>
        {{ t('settings.agent.howBody') }}
        <div class="mt-2.5 font-semibold text-fg-2">
          {{ t('settings.agent.tokens', { n: tokens.toLocaleString() }) }}
        </div>
      </div>
      <div class="rounded-[14px] border border-line-2 bg-surface px-4 py-3.5">
        <div class="mb-2 text-sm font-bold text-fg-2">{{ t('settings.agent.addSection') }}</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in AGENT_SNIPPETS"
            :key="s.id"
            type="button"
            class="flex h-7 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-xs font-semibold text-fg-2 hover:border-primary-ring hover:text-primary-strong"
            @click="append(s.text)"
          >
            <Plus :size="12" />{{ t(`settings.agent.snippets.${s.id}`) }}
          </button>
        </div>
      </div>
      <PButton variant="ai" :icon="WandSparkles" @click="draftFromApp">{{
        t('settings.agent.draft')
      }}</PButton>
    </aside>
  </div>
</template>

<style scoped>
.agent-md :deep(h1) {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-fg);
  margin: 0 0 8px;
}
.agent-md :deep(h2) {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-fg);
  margin: 18px 0 4px;
}
.agent-md :deep(h3) {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--color-fg);
  margin: 14px 0 4px;
}
.agent-md :deep(p) {
  margin: 4px 0;
}
.agent-md :deep(ul),
.agent-md :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}
.agent-md :deep(ul) {
  list-style: disc;
}
.agent-md :deep(ol) {
  list-style: decimal;
}
.agent-md :deep(code) {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-subtle);
  padding: 1px 5px;
  border-radius: 4px;
}
.agent-md :deep(a) {
  color: var(--color-primary-strong);
  text-decoration: underline;
}
</style>
