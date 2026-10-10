<script setup lang="ts">
/**
 * Studio AI panel shown in the right panel of every layer (requirements §3.9).
 * Contract for other features: pass the current selection as `context`; the panel emits nothing —
 * plans are applied through the definition store, and only when the user says so.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Eye } from 'lucide-vue-next'
import type { AiChip, AiModel } from '@platon/definition'
import type { SelectOption } from '@platon/ui'
import { useDefinitionStore } from '@/stores/definition'
import { useSessionStore } from '@/stores/session'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useAiContextInfo, useAiConversations } from './api'
import { useAiConversation } from './useAiConversation'
import { contextIcon, suggestionsFor } from './skills'
import { attachedTokens, chatTokens, chipPaths, definitionOutlineTokens } from './tokens'
import type { AiContext, RingRow } from './types'
import AiHeader from './components/AiHeader.vue'
import HistoryDrawer from './components/HistoryDrawer.vue'
import MessageList from './components/MessageList.vue'
import Composer from './components/Composer.vue'

const props = defineProps<{ context?: AiContext | null; compact?: boolean }>()
const { t } = useI18n()
const router = useRouter()
const pid = useProjectId()
const defs = useDefinitionStore()
const session = useSessionStore()
const ai = useAiConversation(pid)
const st = ai.state
const history = useAiConversations(pid)
const info = useAiContextInfo(pid)

const historyOpen = ref(false)
const text = ref('')
const chips = ref<AiChip[]>([])
const composer = ref<InstanceType<typeof Composer>>()

// The current selection rides along as a removable chip; a new selection replaces it.
const autoKey = ref<string | null>(null)
watch(
  () => (props.context ? `${props.context.kind}:${props.context.path ?? ''}:${props.context.label}` : null),
  () => {
    const c = props.context
    const kept = chips.value.filter((x) => x.key !== autoKey.value)
    if (!c || c.kind === 'project') {
      chips.value = kept
      autoKey.value = null
      return
    }
    const chip: AiChip = {
      kind: 'ctx',
      key: `ctx:${c.path ?? `${c.kind}:${c.label}`}`,
      label: c.label,
      icon: contextIcon(c.kind),
      context: c,
    }
    autoKey.value = chip.key
    chips.value = kept.some((x) => x.key === chip.key) ? kept : [...kept, chip]
  },
  { immediate: true },
)

const title = computed(() => st.value.title || t('ai.newConversation'))
const pendingNaming = computed(() =>
  [...st.value.messages].reverse().find((m) => m.naming?.status === 'pending'),
)
const componentIds = computed(() => new Set((defs.definition?.components ?? []).map((c) => c.id)))
const suggestions = computed(() => suggestionsFor(props.context?.kind))

const models = computed<SelectOption<AiModel>[]>(() =>
  (
    info.data.value?.models ?? [
      { id: 'claude', label: 'Claude' },
      { id: 'gpt', label: 'GPT' },
    ]
  ).map((m) => ({ value: m.id, label: m.label })),
)
const model = computed({ get: () => st.value.model, set: (v: AiModel) => (st.value.model = v) })

// Token budget — the outline is recomputed only when the definition object changes.
const outlineTok = computed(() => definitionOutlineTokens(defs.definition))
const ringRows = computed<RingRow[]>(() => {
  const paths = chipPaths(chips.value)
  const attached = attachedTokens(defs.definition, paths)
  const n = st.value.messages.length
  return [
    {
      key: 'system',
      label: t('ai.ctx.system'),
      desc: t('ai.ctx.systemDesc'),
      tokens: info.data.value?.systemTokens ?? 3200,
      swatch: 'bg-faint',
    },
    {
      key: 'agent',
      label: t('ai.ctx.agent'),
      desc: t('ai.ctx.agentDesc'),
      tokens: info.data.value?.agentMdTokens ?? 0,
      swatch: 'bg-warn-dot',
    },
    {
      key: 'definition',
      label: t('ai.ctx.definition'),
      desc: t('ai.ctx.definitionDesc', paths.length),
      tokens: outlineTok.value + attached,
      swatch: 'bg-primary',
    },
    {
      key: 'chat',
      label: t('ai.ctx.chat'),
      desc: t('ai.ctx.chatDesc', n),
      tokens: chatTokens(st.value.messages, text.value),
      swatch: 'bg-teal',
    },
  ]
})

async function send(override?: string) {
  const body = (override ?? text.value).trim()
  const sendChips = override !== undefined ? chips.value.filter((c) => c.key === autoKey.value) : chips.value
  if (!body && !sendChips.length) return
  const naming = pendingNaming.value
  const namingFor =
    naming && !sendChips.some((c) => c.kind === 'skill') && /^[A-Za-z][A-Za-z0-9]*$/.test(body)
      ? naming.id
      : undefined
  historyOpen.value = false
  const prevText = text.value
  const prevChips = chips.value
  text.value = ''
  // Keep the selection chip for the next prompt; skills and @-context are one-shot.
  chips.value = chips.value.filter((c) => c.key === autoKey.value)
  const ok = await ai.send({
    text: body,
    chips: namingFor ? [] : sendChips,
    context: props.context ?? null,
    ...(namingFor ? { namingFor } : {}),
  })
  if (!ok && !st.value.streaming && override === undefined && !text.value) {
    text.value = prevText
    chips.value = prevChips
  }
}

function pickName(messageId: string, name: string) {
  void ai.send({ text: name, chips: [], context: props.context ?? null, namingFor: messageId })
}

function openChat(id: string) {
  historyOpen.value = false
  void ai.open(id)
}

function newChat() {
  historyOpen.value = false
  ai.newChat()
  composer.value?.focus()
}

const links = computed(() => projectLinks(pid.value))
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col bg-surface" :aria-label="t('ai.title')">
    <AiHeader
      :title="title"
      :history-open="historyOpen"
      @toggle-history="historyOpen = !historyOpen"
      @new-chat="newChat"
    />
    <HistoryDrawer
      v-if="historyOpen"
      :items="history.data.value ?? []"
      :loading="history.isLoading.value"
      :current-id="st.conversationId"
      :me="session.user?.name"
      @open="openChat"
    />
    <MessageList
      v-else
      :messages="st.messages"
      :thinking="st.thinking || st.loading"
      :streaming="st.streaming"
      :checked="st.checked"
      :busy="st.busy"
      :suggestions="compact ? suggestions.slice(0, 2) : suggestions"
      :component-ids="componentIds"
      @toggle="ai.toggleItem"
      @apply="ai.applyPlan"
      @discard="ai.discardPlan"
      @apply-diff="ai.applyDiff"
      @pick-name="pickName"
      @open-component="router.push(links.components($event))"
      @suggest="send"
      @preview="router.push(links.preview())"
      @changes="router.push(links.releases())"
    />
    <div
      v-if="ai.unseen.value.length"
      class="flex shrink-0 flex-col gap-1 border-t border-line-faint bg-bg-home px-3.5 py-2 text-xs text-fg-2"
      role="status"
    >
      <div class="flex items-center gap-1.5 font-bold text-fg">
        <Eye :size="13" />{{
          ai.unseen.value.length === 1 ? t('ai.unseenOne') : t('ai.unseenMany', { n: ai.unseen.value.length })
        }}
      </div>
      <div v-for="c in ai.unseen.value.slice(-2)" :key="c.id" class="truncate pl-[19px] text-muted">
        {{ c.text }}
      </div>
    </div>
    <Composer
      ref="composer"
      v-model:text="text"
      v-model:chips="chips"
      v-model:model="model"
      :definition="defs.definition"
      :context="context"
      :streaming="st.streaming"
      :ring-rows="ringRows"
      :max-tokens="info.data.value?.maxTokens ?? 200_000"
      :models="models"
      :placeholder="pendingNaming ? t('ai.placeholderNaming') : undefined"
      @send="send()"
      @stop="ai.stop"
    />
  </section>
</template>
