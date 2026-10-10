<script setup lang="ts">
/** Right panel for APIs: API · Cache · Problems · Test · Runs · History. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { findStep, type Api, type Problem, type Step } from '@platon/definition'
import { PTabs, type TabItem } from '@platon/ui'
import ProblemsList from '@/components/common/ProblemsList.vue'
import { useLogicEditor, type ApiTab } from '../../store'
import StepInspector from '../inspector/StepInspector.vue'
import ApiSettings from './ApiSettings.vue'
import ApiCache from './ApiCache.vue'
import ApiTest from './ApiTest.vue'
import ApiRuns from './ApiRuns.vue'
import ApiHistory from './ApiHistory.vue'

const props = defineProps<{ api: Api; path: string; problems: Problem[] }>()
const emit = defineEmits<{ edit: [fn: (a: Api) => Api]; remove: [] }>()
const { t } = useI18n()
const ed = useLogicEditor()

const errors = computed(() => props.problems.filter((p) => p.severity === 'error').length)
const tabs = computed<TabItem<ApiTab>[]>(() => [
  { value: 'api', label: t('logic.api.tabs.api') },
  { value: 'cache', label: t('logic.api.tabs.cache') },
  {
    value: 'problems',
    label: t('logic.api.tabs.problems'),
    count: props.problems.length || undefined,
    tone: errors.value ? 'danger' : 'warn',
  },
  { value: 'test', label: t('logic.api.tabs.test') },
  { value: 'runs', label: t('logic.api.tabs.runs') },
  { value: 'history', label: t('logic.api.tabs.history') },
])
const tab = computed({ get: () => ed.apiTab, set: (v: ApiTab) => (ed.apiTab = v) })
const selected = computed(() => {
  const id = ed.selected[props.path]
  return id ? findStep(props.api.steps, id) : undefined
})
/** API inputs are the request fields; an API can return anything. */
const owner = computed(() => ({
  params: [
    ...props.api.request.path,
    ...props.api.request.query,
    ...props.api.request.headers,
    ...props.api.request.body,
  ],
  returns: { type: 'any' },
}))

function onSteps(steps: Step[]) {
  emit('edit', (a) => ({ ...a, steps }))
}
function jump(p: Problem) {
  const m = /\/steps\/([^/]+)/.exec(p.path)
  if (m) ed.select(props.path, m[1]!)
  else {
    ed.select(props.path, null)
    tab.value = 'api'
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <PTabs v-model="tab" :items="tabs" class="shrink-0 gap-3 overflow-x-auto px-4 scroll-thin" />
    <div class="min-h-0 flex-1 overflow-auto scroll-thin">
      <template v-if="tab === 'api'">
        <StepInspector
          v-if="selected"
          :path="path"
          :step="selected"
          :steps="api.steps"
          :owner="owner"
          :problems="problems"
          @change="onSteps"
        />
        <ApiSettings v-else :api="api" @edit="emit('edit', $event)" @remove="emit('remove')" />
      </template>
      <ApiCache v-else-if="tab === 'cache'" :api="api" @edit="emit('edit', $event)" />
      <div v-else-if="tab === 'problems'" class="px-2 py-3">
        <p class="px-2 pb-2 text-xs text-faint">{{ t('logic.api.problemsHint') }}</p>
        <ProblemsList :problems="problems" :empty-text="t('logic.noProblems')" @select="jump" />
      </div>
      <ApiTest v-else-if="tab === 'test'" :api="api" :path="path" />
      <ApiRuns v-else-if="tab === 'runs'" :id="api.id" />
      <ApiHistory v-else :id="api.id" kind="apis" />
    </div>
  </div>
</template>
