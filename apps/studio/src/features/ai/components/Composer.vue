<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowUp, Square } from 'lucide-vue-next'
import { PButton, PSelect, type SelectOption } from '@platon/ui'
import type { AiChip, AiModel, AppDefinition } from '@platon/definition'
import { atGroups, slashGroups } from '../skills'
import type { AiContext, PickItem, RingRow } from '../types'
import ChipPill from './ChipPill.vue'
import SlashMenu from './SlashMenu.vue'
import ContextRing from './ContextRing.vue'

const props = defineProps<{
  definition: AppDefinition | null
  context?: AiContext | null
  streaming: boolean
  ringRows: RingRow[]
  maxTokens: number
  models: SelectOption<AiModel>[]
  placeholder?: string
}>()
const emit = defineEmits<{ send: []; stop: [] }>()
const text = defineModel<string>('text', { required: true })
const chips = defineModel<AiChip[]>('chips', { required: true })
const model = defineModel<AiModel>('model', { required: true })
const { t } = useI18n()
const menuId = useId()

const ta = ref<HTMLTextAreaElement>()
/** Open trigger menu: which character, the query typed after it and where the trigger starts. */
const menu = ref<{ trig: '/' | '@'; q: string; at: number } | null>(null)
const active = ref(0)

const groups = computed(() => {
  const m = menu.value
  if (!m) return []
  return m.trig === '@'
    ? atGroups(props.definition, props.context, m.q, t('ai.groupContext'))
    : slashGroups(props.definition, props.context, m.q, {
        skills: t('ai.groupSkills'),
        context: t('ai.groupContext'),
        templates: t('ai.groupTemplates'),
      })
})
const flat = computed(() => groups.value.flatMap((g) => g.items))
const activeIdx = computed(() => Math.min(active.value, Math.max(flat.value.length - 1, 0)))

function detect() {
  const el = ta.value
  const caret = el?.selectionStart ?? text.value.length
  const m = /(^|\s)([/@])([^\s/@]*)$/.exec(text.value.slice(0, caret))
  const next = m ? { trig: m[2] as '/' | '@', q: m[3] ?? '', at: caret - (m[3]?.length ?? 0) - 1 } : null
  if (next?.trig !== menu.value?.trig || next?.q !== menu.value?.q) active.value = 0
  menu.value = next
}

function focus() {
  void nextTick(() => ta.value?.focus())
}

function pick(it: PickItem) {
  const m = menu.value
  const caret = ta.value?.selectionStart ?? text.value.length
  const rest = m ? text.value.slice(0, m.at) + text.value.slice(caret) : text.value
  menu.value = null
  if (it.kind === 'tpl') {
    text.value = it.prompt ?? ''
    focus()
    return
  }
  text.value = rest.replace(/\s+$/, rest.trim() ? ' ' : '')
  const chip: AiChip = {
    kind: it.kind,
    key: it.key,
    label: it.label,
    icon: it.icon,
    ...(it.skill ? { skill: it.skill } : {}),
    ...(it.context ? { context: it.context } : {}),
  }
  if (!chips.value.some((c) => c.key === chip.key))
    chips.value = [...chips.value.filter((c) => !(chip.kind === 'skill' && c.kind === 'skill')), chip]
  focus()
}

function openTrigger(trig: '/' | '@') {
  const needsSpace = text.value && !/\s$/.test(text.value)
  text.value = `${text.value}${needsSpace ? ' ' : ''}${trig}`
  menu.value = { trig, q: '', at: text.value.length - 1 }
  active.value = 0
  void nextTick(() => {
    const el = ta.value
    if (!el) return
    el.focus()
    el.setSelectionRange(text.value.length, text.value.length)
  })
}

function onKey(e: KeyboardEvent) {
  if (e.isComposing) return
  if (menu.value) {
    const n = flat.value.length
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      menu.value = null
      return
    }
    if (n && e.key === 'ArrowDown') {
      e.preventDefault()
      active.value = (activeIdx.value + 1) % n
      return
    }
    if (n && e.key === 'ArrowUp') {
      e.preventDefault()
      active.value = (activeIdx.value - 1 + n) % n
      return
    }
    if (n && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault()
      pick(flat.value[activeIdx.value]!)
      return
    }
  }
  if (e.key === 'Backspace' && !text.value && chips.value.length) {
    chips.value = chips.value.slice(0, -1)
    return
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (!props.streaming) emit('send')
  }
}

function removeChip(key: string) {
  chips.value = chips.value.filter((c) => c.key !== key)
  focus()
}

const canSend = computed(() => !!text.value.trim() || chips.value.length > 0)

defineExpose({ focus })
</script>

<template>
  <div class="relative shrink-0 border-t border-line-faint p-3">
    <SlashMenu
      v-if="menu"
      :id="menuId"
      :trigger="menu.trig"
      :groups="groups"
      :active="activeIdx"
      @pick="pick"
      @hover="active = $event"
    />
    <div
      class="rounded-xl border border-line bg-surface pt-2 pr-2 pb-1.5 pl-2.5 transition-shadow focus-within:border-primary focus-within:shadow-focus"
    >
      <div v-if="chips.length" class="flex flex-wrap gap-1.5 pb-2">
        <ChipPill
          v-for="c in chips"
          :key="c.key"
          :chip="c"
          removable
          :remove-label="t('ai.removeChip', { label: c.label })"
          @remove="removeChip(c.key)"
        />
      </div>
      <textarea
        ref="ta"
        v-model="text"
        rows="2"
        :placeholder="placeholder ?? t('ai.placeholder')"
        :aria-label="t('ai.placeholder')"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="!!menu"
        :aria-controls="menu ? menuId : undefined"
        :aria-activedescendant="menu && flat.length ? `${menuId}-${activeIdx}` : undefined"
        class="block max-h-40 w-full resize-none bg-transparent py-0.5 text-md leading-snug text-fg outline-none placeholder:text-faint"
        @input="detect"
        @click="detect"
        @keydown="onKey"
        @blur="menu = null"
      />
      <div class="mt-1 flex items-center gap-1.5">
        <button
          type="button"
          class="flex h-7 items-center gap-1 rounded-[7px] border border-line-soft bg-surface px-2 text-xs font-semibold text-fg-2 hover:border-primary-ring hover:text-primary-strong"
          :title="t('ai.skillsTitle')"
          @mousedown.prevent
          @click="openTrigger('/')"
        >
          <span class="font-mono font-bold">/</span>{{ t('ai.skillsBtn') }}
        </button>
        <button
          type="button"
          class="flex h-7 items-center gap-1 rounded-[7px] border border-line-soft bg-surface px-2 text-xs font-semibold text-fg-2 hover:border-teal/40 hover:text-teal"
          :title="t('ai.contextTitle')"
          @mousedown.prevent
          @click="openTrigger('@')"
        >
          <span class="font-mono font-bold">@</span>{{ t('ai.contextBtn') }}
        </button>
        <div class="ml-auto flex items-center gap-0.5">
          <PSelect
            v-model="model"
            :options="models"
            size="sm"
            :aria-label="t('ai.model')"
            class="h-7 w-auto border-transparent px-1.5 text-xs shadow-none"
          />
          <ContextRing :rows="ringRows" :max="maxTokens" />
          <PButton
            v-if="streaming"
            variant="ink"
            size="sm"
            square
            :icon="Square"
            :label="t('ai.stop')"
            @click="emit('stop')"
          />
          <PButton
            v-else
            variant="primary"
            size="sm"
            square
            :icon="ArrowUp"
            :label="t('ai.send')"
            :disabled="!canSend"
            class="rounded-[9px]"
            @click="emit('send')"
          />
        </div>
      </div>
    </div>
    <div class="mt-1.5 pl-0.5 text-2xs text-faint">{{ t('ai.footer') }}</div>
  </div>
</template>
