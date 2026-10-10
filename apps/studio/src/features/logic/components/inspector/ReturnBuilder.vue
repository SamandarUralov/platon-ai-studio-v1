<script setup lang="ts">
/** Return layer: a variable or a function call, checked against the declared return type. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleAlert, CircleCheck, TriangleAlert, Wand2 } from 'lucide-vue-next'
import type { LogicFunction, Step } from '@platon/definition'
import { PField, PInput, PSegmented, PSelect } from '@platon/ui'
import { checkReturn, defaultArgs, signature } from '../../lib/infer'

const props = defineProps<{
  step: Step
  steps: Step[]
  /** Signature of the method; APIs and crons don't declare one (anything can be returned). */
  owner: Pick<LogicFunction, 'params' | 'returns'>
  functions: LogicFunction[]
}>()
const emit = defineEmits<{ patch: [cfg: Record<string, string>] }>()
const { t } = useI18n()

const check = computed(() => checkReturn(props.owner, props.step, props.steps, props.functions))
const mode = computed({
  get: () => (props.step.config.from === 'fn' ? 'fn' : 'var'),
  set: (v: 'var' | 'fn') => emit('patch', { from: v }),
})
const varOptions = computed(() =>
  check.value.vars.map((v) => ({ value: v.name, label: `${v.name} · ${v.type}`, description: v.source })),
)
const fnOptions = computed(() => props.functions.map((f) => ({ value: f.name, label: f.name })))
const chosenFn = computed(() => props.functions.find((f) => f.name === props.step.config.fn))
const currentVar = computed(() => props.step.config.value || check.value.defaultVar)

function pickFn(name: string | undefined) {
  const f = props.functions.find((x) => x.name === name)
  if (f) emit('patch', { fn: f.name, args: props.step.config.args || defaultArgs(f) })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="eyebrow">{{ t('logic.ret.title') }}</div>
    <p v-if="check.isVoid" class="text-sm text-muted">{{ t('logic.ret.void') }}</p>
    <template v-else>
      <PSegmented
        v-model="mode"
        block
        :options="[
          { value: 'var', label: t('logic.ret.variable') },
          { value: 'fn', label: t('logic.ret.call') },
        ]"
      />
      <template v-if="mode === 'var'">
        <PField :label="t('logic.ret.varLabel')">
          <p v-if="!check.vars.length" class="text-sm text-faint">{{ t('logic.ret.noVars') }}</p>
          <PSelect
            v-else
            :model-value="currentVar || undefined"
            :options="varOptions"
            :placeholder="t('logic.ret.pickVar')"
            class="font-mono"
            @update:model-value="emit('patch', { value: $event ?? '' })"
          />
        </PField>
        <button
          v-if="check.defaultVar && step.config.value !== check.defaultVar"
          type="button"
          class="inline-flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-sm font-semibold text-primary-strong hover:bg-primary-tint"
          @click="emit('patch', { value: check.defaultVar })"
        >
          <Wand2 :size="13" />{{ t('logic.ret.useLast', { name: check.defaultVar }) }}
        </button>
      </template>
      <template v-else>
        <PField :label="t('logic.ret.function')">
          <PSelect
            :model-value="step.config.fn || undefined"
            :options="fnOptions"
            :placeholder="t('logic.ret.pickFn')"
            @update:model-value="pickFn"
          />
        </PField>
        <p v-if="chosenFn" class="-mt-1.5 font-mono text-xs text-faint">{{ signature(chosenFn) }}</p>
        <PField :label="t('logic.ret.args')">
          <PInput
            mono
            size="sm"
            :model-value="step.config.args ?? ''"
            @update:model-value="emit('patch', { args: String($event ?? '') })"
          />
        </PField>
      </template>
    </template>

    <div class="rounded-lg border border-line-soft bg-subtle p-2.5 text-sm">
      <div class="grid grid-cols-[72px_1fr] gap-y-1">
        <span class="text-faint">{{ t('logic.ret.returns') }}</span
        ><span class="truncate font-mono text-fg">{{ check.source ?? '—' }}</span>
        <span class="text-faint">{{ t('logic.ret.expected') }}</span
        ><span class="truncate font-mono text-fg">{{ check.expected }}</span>
      </div>
      <div v-if="check.error" class="mt-2 flex items-start gap-1.5 text-danger">
        <CircleAlert :size="14" class="mt-0.5 shrink-0" />{{ check.error }}
      </div>
      <div v-else-if="check.warning" class="mt-2 flex items-start gap-1.5 text-warn">
        <TriangleAlert :size="14" class="mt-0.5 shrink-0" />{{ check.warning }}
      </div>
      <div v-else-if="!check.isVoid" class="mt-2 flex items-center gap-1.5 text-ok">
        <CircleCheck :size="14" />{{ t('logic.ret.ok') }}
      </div>
    </div>
  </div>
</template>
