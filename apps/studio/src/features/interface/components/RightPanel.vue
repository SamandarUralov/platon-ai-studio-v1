<script setup lang="ts">
/** Right panel: Properties (page settings or block inspector) | Studio AI. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PanelRightClose, SlidersHorizontal, Sparkles } from 'lucide-vue-next'
import { BLOCKS, type Page } from '@platon/definition'
import AiPanel from '@/features/ai/AiPanel.vue'
import type { AiContext } from '@/features/ai/types'
import { useInterfaceStore, type RightTab } from '../store'
import PageSettings from './PageSettings.vue'
import BlockInspector from './BlockInspector.vue'

const props = defineProps<{ page: Page; close: () => void }>()
const { t } = useI18n()
const ui = useInterfaceStore()
const block = computed(() => props.page.blocks.find((b) => b.id === ui.selected) ?? null)
const codeMode = computed(() => ui.mode === 'code')
const tab = computed<RightTab>(() => (codeMode.value ? 'ai' : ui.rightTab))
const tabs = computed(() => [
  { value: 'props' as const, label: t('interface.right.props'), icon: SlidersHorizontal },
  { value: 'ai' as const, label: t('interface.right.ai'), icon: Sparkles },
])
const aiContext = computed<AiContext>(() =>
  codeMode.value
    ? {
        kind: 'code',
        path: `/interface/pages/${props.page.id}/script`,
        label: t('interface.right.ctxCode', { page: props.page.name }),
      }
    : block.value
      ? {
          kind: 'block',
          path: `/interface/pages/${props.page.id}/blocks/${block.value.id}`,
          label: `${BLOCKS[block.value.type].label} · ${block.value.title ?? block.value.ref}`,
        }
      : { kind: 'page', path: `/interface/pages/${props.page.id}`, label: props.page.name },
)
</script>

<template>
  <div class="flex h-14 shrink-0 items-center gap-1 border-b border-line-2 px-2.5">
    <template v-for="x in tabs" :key="x.value">
      <button
        v-if="!codeMode || x.value === 'ai'"
        type="button"
        class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-base font-semibold"
        :class="tab === x.value ? 'bg-primary-tint text-primary-strong' : 'text-fg-2 hover:bg-hover'"
        :aria-pressed="tab === x.value"
        @click="ui.rightTab = x.value"
      >
        <component :is="x.icon" :size="15" />{{ x.label }}
      </button>
    </template>
    <button
      type="button"
      class="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"
      :aria-label="t('interface.right.hide')"
      @click="close()"
    >
      <PanelRightClose :size="16" />
    </button>
  </div>
  <AiPanel v-if="tab === 'ai'" :context="aiContext" />
  <div v-else class="min-h-0 flex-1 overflow-y-auto scroll-thin">
    <BlockInspector v-if="block" :key="block.id" :page="page" :block="block" @ask-ai="ui.rightTab = 'ai'" />
    <PageSettings v-else :key="page.id" :page="page" />
  </div>
</template>
