<script setup lang="ts">
/** Right-panel form for the selected layer (fields per STEPS[type]), Return builder and actions. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Trash2 } from 'lucide-vue-next'
import {
  cloneStep,
  insertStep,
  locateStep,
  moveStep,
  newId,
  removeStep,
  STEPS,
  updateStep,
  type LogicFunction,
  type Step,
  type StepBranch,
} from '@platon/definition'
import { PButton, PField, PInput, PSelect, PTextarea, type SelectOption } from '@platon/ui'
import ProblemsList from '@/components/common/ProblemsList.vue'
import type { Problem } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { useLogicEditor } from '../../store'
import { defaultArgs, signature } from '../../lib/infer'
import ToneTile from '../ToneTile.vue'
import ReturnBuilder from './ReturnBuilder.vue'

const props = defineProps<{
  path: string
  step: Step
  steps: Step[]
  owner: Pick<LogicFunction, 'params' | 'returns'>
  problems: Problem[]
}>()
const emit = defineEmits<{ change: [steps: Step[]] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const ed = useLogicEditor()

const meta = computed(() => STEPS[props.step.type])
const functions = computed(() => def.definition?.logic.functions ?? [])
const loc = computed(() => locateStep(props.steps, props.step.id))
const locked = computed(() => props.step.type === 'return')
const stepProblems = computed(() => props.problems.filter((p) => p.path.endsWith(`/steps/${props.step.id}`)))

function options(src: (typeof meta.value.fields)[number]['options']): SelectOption<string>[] {
  const d = def.definition
  if (src === 'tables')
    return (d?.data.tables ?? []).map((x) => ({ value: x.id, label: x.id, description: x.name }))
  if (src === 'queues') return (d?.logic.queues ?? []).map((x) => ({ value: x.id, label: x.name }))
  if (src === 'functions') return functions.value.map((x) => ({ value: x.name, label: x.name }))
  return (src ?? []).map((x) => ({ value: x, label: x }))
}

/** Keep switch cases and loop labels in sync with their branches; existing branch layers stay. */
function syncBranches(s: Step): Step {
  const br = s.branches ?? []
  if (s.type === 'switch') {
    const cases = (s.config.cases ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    const find = (label: string) => br.find((b) => b.label === label)
    const next: StepBranch[] = cases.map(
      (c) => find(`Case ${c}`) ?? { id: newId('br'), label: `Case ${c}`, steps: [] },
    )
    next.push(find('Default') ?? { id: newId('br'), label: 'Default', steps: [] })
    // Layers of a removed case move to Default instead of disappearing.
    const orphan = br.filter((b) => !next.includes(b)).flatMap((b) => b.steps)
    if (orphan.length)
      next[next.length - 1] = {
        ...next[next.length - 1]!,
        steps: [...next[next.length - 1]!.steps, ...orphan],
      }
    return { ...s, branches: next }
  }
  if (s.type === 'for' && br[0])
    return { ...s, branches: [{ ...br[0], label: `Each ${s.config.as || 'item'}` }, ...br.slice(1)] }
  return s
}

function patch(cfg: Record<string, string>) {
  emit(
    'change',
    updateStep(props.steps, props.step.id, (s) => syncBranches({ ...s, config: { ...s.config, ...cfg } })),
  )
}

function setField(key: string, v: unknown) {
  const val = String(v ?? '')
  if (props.step.type === 'call' && key === 'fn') {
    const f = functions.value.find((x) => x.name === val)
    patch({ fn: val, ...(f && !props.step.config.args ? { args: defaultArgs(f) } : {}) })
  } else patch({ [key]: val })
}

function setNote(v: unknown) {
  const note = String(v ?? '')
  emit(
    'change',
    updateStep(props.steps, props.step.id, (s) =>
      note ? { ...s, note } : (({ note: _n, ...rest }) => rest)(s),
    ),
  )
}

function shift(by: -1 | 1) {
  const at = loc.value
  if (!at) return
  const to = at.index + by
  if (to < 0 || to >= at.length) return
  emit('change', moveStep(props.steps, props.step.id, at.branchId, by > 0 ? to + 1 : to))
}
function duplicate() {
  const at = loc.value
  if (!at) return
  const copy = cloneStep(props.step)
  emit('change', insertStep(props.steps, at.branchId, at.index + 1, copy))
  ed.select(props.path, copy.id)
}
function remove() {
  emit('change', removeStep(props.steps, props.step.id))
  ed.select(props.path, null)
}

const calledFn = computed<LogicFunction | undefined>(() =>
  props.step.type === 'call' ? functions.value.find((f) => f.name === props.step.config.fn) : undefined,
)
</script>

<template>
  <div class="flex flex-col">
    <div class="flex items-center gap-2.5 border-b border-line-faint px-4 py-3">
      <ToneTile :icon="meta.icon" :tone="meta.tone" />
      <div class="min-w-0 flex-1">
        <div class="text-md font-bold">{{ meta.label }}</div>
        <div class="truncate text-xs text-faint">
          {{ t('logic.inspector.layerSub', { id: step.id, group: meta.group }) }}
        </div>
      </div>
      <PButton
        size="xs"
        variant="ghost"
        square
        :icon="ArrowLeft"
        :label="t('logic.inspector.back')"
        :title="t('logic.inspector.back')"
        @click="ed.select(path, null)"
      />
    </div>

    <div class="flex flex-col gap-3.5 px-4 py-4">
      <PField v-for="f in meta.fields" :key="f.key" :label="f.label">
        <template #default="{ id }">
          <PSelect
            v-if="f.input === 'select'"
            :id="id"
            :model-value="step.config[f.key] || undefined"
            :options="options(f.options)"
            :placeholder="t('logic.inspector.choose')"
            @update:model-value="setField(f.key, $event)"
          />
          <PTextarea
            v-else-if="f.input === 'area'"
            :id="id"
            mono
            class="min-h-[96px]"
            :model-value="step.config[f.key] ?? ''"
            @update:model-value="setField(f.key, $event)"
          />
          <PInput
            v-else
            :id="id"
            :mono="f.input === 'mono'"
            :model-value="step.config[f.key] ?? ''"
            @update:model-value="setField(f.key, $event)"
          />
        </template>
      </PField>
      <p v-if="calledFn" class="-mt-2 font-mono text-xs text-faint">
        {{ calledFn.name }}{{ signature(calledFn) }}
      </p>

      <ReturnBuilder
        v-if="step.type === 'return'"
        :step="step"
        :steps="steps"
        :owner="owner"
        :functions="functions"
        @patch="patch"
      />

      <PField :label="t('logic.inspector.note')">
        <PInput
          size="sm"
          :model-value="step.note ?? ''"
          :placeholder="t('logic.inspector.notePh')"
          @update:model-value="setNote"
        />
      </PField>

      <div v-if="stepProblems.length" class="rounded-lg border border-danger/30 bg-danger-bg/40">
        <ProblemsList :problems="stepProblems" />
      </div>
    </div>

    <div v-if="!locked" class="grid grid-cols-2 gap-2 border-t border-line-faint px-4 py-3">
      <PButton size="sm" :icon="ArrowUp" :disabled="!loc || loc.index === 0" @click="shift(-1)">{{
        t('logic.step.up')
      }}</PButton>
      <PButton
        size="sm"
        :icon="ArrowDown"
        :disabled="!loc || loc.index >= loc.length - 1"
        @click="shift(1)"
        >{{ t('logic.step.down') }}</PButton
      >
      <PButton size="sm" :icon="Copy" @click="duplicate">{{ t('logic.step.duplicate') }}</PButton>
      <PButton size="sm" variant="danger" :icon="Trash2" @click="remove">{{
        t('logic.step.delete')
      }}</PButton>
    </div>
    <p v-else class="border-t border-line-faint px-4 py-3 text-xs text-faint">
      {{ t('logic.inspector.returnLocked') }}
    </p>
  </div>
</template>
