<script setup lang="ts">
/** Right panel: Layer (selected layer or item settings) | AI assistant. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings2, Sparkles, X } from 'lucide-vue-next'
import {
  findStep,
  type Api,
  type Cron,
  type LogicFunction,
  type LogicKind,
  type Queue,
  type Step,
} from '@platon/definition'
import { PTabs, type TabItem } from '@platon/ui'
import AiPanel from '@/features/ai/AiPanel.vue'
import type { AiContext } from '@/features/ai/types'
import { useLogicItem } from '../composables/useLogicItem'
import { useLogicEditor } from '../store'
import { itemTitle } from '../lib/items'
import type { LogicItem } from '../lib/nav'
import DeleteItem from './DeleteItem.vue'
import StepInspector from './inspector/StepInspector.vue'
import FunctionSettings from './inspector/FunctionSettings.vue'
import CronSettings from './inspector/CronSettings.vue'
import ApiPanel from './api/ApiPanel.vue'
import QueueDelivery from './queue/QueueDelivery.vue'

const props = defineProps<{ kind: LogicKind; id: string; close?: () => void }>()
const { t } = useI18n()
const ed = useLogicEditor()
const L = useLogicItem(
  () => props.kind,
  () => props.id,
)

const tabs = computed<TabItem<'layer' | 'ai'>[]>(() => [
  { value: 'layer', label: t('logic.right.layer'), icon: Settings2 },
  { value: 'ai', label: t('logic.right.ai'), icon: Sparkles },
])
const tab = computed({ get: () => ed.rightTab, set: (v: 'layer' | 'ai') => (ed.rightTab = v) })

const item = computed(() => L.item.value)
const steps = computed<Step[]>(() => (item.value && 'steps' in item.value ? item.value.steps : []))
const selected = computed(() => {
  const id = ed.selected[L.path.value]
  return id ? findStep(steps.value, id) : undefined
})
const owner = computed(() =>
  props.kind === 'functions' ? (item.value as LogicFunction) : { params: [], returns: { type: 'any' } },
)

const AI_KIND = { functions: 'function', apis: 'api', crons: 'cron', queues: 'queue' } as const
const aiContext = computed<AiContext | null>(() =>
  item.value
    ? { kind: AI_KIND[props.kind], path: L.path.value, label: itemTitle(props.kind, item.value) }
    : null,
)

/** Settings forms edit their own item type; the draft holds whichever kind this is. */
function editAs<T extends LogicItem>(fn: (x: T) => T) {
  L.edit((x) => fn(x as T))
}

function onSteps(next: Step[]) {
  L.editSteps(() => next)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex h-12 shrink-0 items-center gap-2 border-b border-line-faint px-3">
      <PTabs v-model="tab" :items="tabs" variant="pill" class="flex-1" />
      <button
        v-if="close"
        type="button"
        class="grid size-7 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg"
        :aria-label="t('logic.right.hide')"
        @click="close"
      >
        <X :size="15" />
      </button>
    </div>
    <AiPanel v-if="tab === 'ai'" :context="aiContext" />
    <template v-else-if="item">
      <ApiPanel
        v-if="kind === 'apis'"
        :api="item as Api"
        :path="L.path.value"
        :problems="L.problems.value"
        @edit="editAs"
        @remove="L.remove"
      />
      <div v-else class="min-h-0 flex-1 overflow-auto scroll-thin">
        <StepInspector
          v-if="selected"
          :path="L.path.value"
          :step="selected"
          :steps="steps"
          :owner="owner"
          :problems="L.problems.value"
          @change="onSteps"
        />
        <FunctionSettings
          v-else-if="kind === 'functions'"
          :fn="item as LogicFunction"
          @edit="editAs"
          @remove="L.remove"
        />
        <CronSettings v-else-if="kind === 'crons'" :cron="item as Cron" @edit="editAs" @remove="L.remove" />
        <div v-else class="flex flex-col">
          <div class="border-b border-line-faint px-4 py-3">
            <div class="text-md font-bold">{{ t('logic.queue.settingsTitle') }}</div>
            <div class="text-xs text-faint">{{ t('logic.queue.settingsSub') }}</div>
          </div>
          <div class="px-4 py-4"><QueueDelivery :queue="item as Queue" compact @edit="editAs" /></div>
          <DeleteItem :name="(item as Queue).name" :noun="t('logic.noun.queues')" @confirm="L.remove" />
        </div>
      </div>
    </template>
  </div>
</template>
