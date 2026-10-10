<script setup lang="ts">
/**
 * One property in the Properties form. Existing props commit field by field (each commit is a
 * definition change); a new prop stays local until "Add". Names are validated before they're written,
 * because an invalid name would break the generated defineProps.
 */
import { computed, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Braces,
  ChevronDown,
  ChevronUp,
  Hash,
  List,
  Plus,
  Sparkles,
  ToggleLeft,
  Trash2,
  Type,
} from 'lucide-vue-next'
import { PButton, PField, PInput, PSelect, PSwitch } from '@platon/ui'
import type { ComponentProp, ComponentPropType } from '@platon/definition'
import { INPUTS_BY_TYPE, labelFromName, PROP_TYPES, propNameError } from './sfc'

const props = defineProps<{
  prop: ComponentProp
  others: string[]
  isNew?: boolean
  open?: boolean
  showAi?: boolean
  readonly?: boolean
}>()
const emit = defineEmits<{
  toggle: []
  commit: [prop: ComponentProp, text: string]
  remove: []
  cancel: []
  add: [prop: ComponentProp]
}>()
const { t } = useI18n()

const ICON: Record<ComponentPropType, Component> = {
  String: Type,
  Number: Hash,
  Boolean: ToggleLeft,
  Array: List,
  Object: Braces,
}
const DEF_PH: Record<ComponentPropType, string> = {
  String: 'Text',
  Number: '0',
  Boolean: 'false',
  Array: '[ ]',
  Object: '{ }',
}

const draft = ref<ComponentProp>({ ...props.prop })
watch(
  () => props.prop,
  (p) => (draft.value = { ...p }),
)
const name = ref(props.prop.name)
watch(
  () => props.prop.name,
  (n) => (name.value = n),
)
const defText = ref(textOf(props.prop.default))
watch(
  () => props.prop.default,
  (d) => (defText.value = textOf(d)),
)
const optsText = ref((props.prop.options ?? []).join(', '))
watch(
  () => props.prop.options,
  (o) => (optsText.value = (o ?? []).join(', ')),
)

function textOf(d: unknown): string {
  if (d == null) return ''
  return typeof d === 'string' ? d : JSON.stringify(d)
}

const nameErr = computed(() => {
  const n = name.value.trim()
  if (props.isNew && !n) return null
  const e = propNameError(n, props.others)
  return e ? t(`components.prop.err.${e}`, { name: n }) : null
})

const typeOptions = PROP_TYPES.map((x) => ({ value: x, label: x, icon: ICON[x] }))
const inputOptions = computed(() =>
  INPUTS_BY_TYPE[draft.value.type].map((k) => ({ value: k, label: t(`components.inputKind.${k}`) })),
)
const hasDefault = computed(
  () => !draft.value.required && draft.value.input !== 'source' && draft.value.input !== 'record',
)

function commit(patch: Partial<ComponentProp>, text: string) {
  const next: ComponentProp = { ...draft.value, ...patch }
  for (const k of Object.keys(next) as (keyof ComponentProp)[]) if (next[k] === undefined) delete next[k]
  draft.value = next
  if (!props.isNew) emit('commit', next, text)
}

function commitName() {
  const n = name.value.trim()
  name.value = n
  if (n === props.prop.name || nameErr.value) return
  if (props.isNew) draft.value = { ...draft.value, name: n }
  else commit({ name: n }, `Renamed property ${props.prop.name} to ${n}`)
}

function parseDefault(s: string, type: ComponentPropType): unknown {
  const v = s.trim()
  if (v === '') return undefined
  if (type === 'Number') return Number.isFinite(Number(v)) ? Number(v) : v
  if (type === 'Array' || type === 'Object') {
    try {
      return JSON.parse(v) as unknown
    } catch {
      return v
    }
  }
  return v
}

function setType(type: ComponentPropType) {
  commit(
    {
      type,
      input: INPUTS_BY_TYPE[type][0]!,
      default: type === 'Boolean' ? false : undefined,
      options: undefined,
    },
    `Changed type of ${draft.value.name} to ${type}`,
  )
  defText.value = textOf(draft.value.default)
}
function setInput(input: ComponentProp['input']) {
  commit(
    { input, options: input === 'select' ? (draft.value.options ?? []) : undefined },
    `Changed input of ${draft.value.name}`,
  )
}
function commitOptions() {
  const options = optsText.value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  commit({ options }, `Changed options of ${draft.value.name}`)
}
function commitDefault() {
  commit({ default: parseDefault(defText.value, draft.value.type) }, `Changed default of ${draft.value.name}`)
}

function add() {
  const n = name.value.trim()
  const e = propNameError(n, props.others)
  if (e) {
    name.value = n
    return
  }
  const p: ComponentProp = { ...draft.value, name: n, label: draft.value.label || labelFromName(n) }
  if (hasDefault.value) {
    const d = parseDefault(defText.value, p.type)
    if (d !== undefined) p.default = d
  }
  if (p.input === 'select')
    p.options = optsText.value
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  emit('add', p)
}
</script>

<template>
  <div
    class="shrink-0 rounded-[10px] border bg-surface"
    :class="open || isNew ? 'border-primary-ring' : 'border-line-2'"
  >
    <button
      v-if="!isNew"
      type="button"
      class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-hover"
      :aria-expanded="open"
      @click="emit('toggle')"
    >
      <span
        class="grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-primary-tint text-primary-strong"
      >
        <component :is="ICON[prop.type]" :size="13" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-1">
          <span class="truncate font-mono text-sm font-bold">{{ prop.name }}</span>
          <span v-if="prop.required" :title="t('components.prop.required')" class="font-bold text-danger"
            >*</span
          >
          <Sparkles
            v-if="showAi && prop.ai"
            :size="12"
            class="shrink-0 text-purple"
            :aria-label="t('components.prop.aiGenerated')"
          />
        </span>
        <span class="block truncate text-xs text-faint"
          >{{ prop.label || t('components.prop.noLabel') }} ·
          {{ t(`components.inputKind.${prop.input}`) }}</span
        >
      </span>
      <span
        class="flex h-5 shrink-0 items-center rounded-[5px] bg-subtle px-1.5 font-mono text-2xs text-fg-2"
        >{{ prop.type }}</span
      >
      <component :is="open ? ChevronUp : ChevronDown" :size="14" class="shrink-0 text-faint" />
    </button>
    <div v-else class="flex items-center gap-1.5 px-3 pt-2.5 text-sm font-bold">
      <Plus :size="13" class="text-primary" />{{ t('components.prop.new') }}
    </div>

    <fieldset
      v-if="open || isNew"
      :disabled="readonly"
      class="m-0 flex min-w-0 flex-col gap-2.5 border-0 px-3 pb-3 pt-2.5"
    >
      <div class="grid grid-cols-2 gap-2">
        <PField :label="t('components.prop.name')">
          <template #default="{ id }">
            <PInput
              :id="id"
              :model-value="name"
              mono
              :invalid="!!nameErr"
              placeholder="e.g. title"
              autocomplete="off"
              spellcheck="false"
              @update:model-value="name = String($event ?? '').replace(/\s+/g, '')"
              @change="commitName"
              @keydown.enter="commitName"
            />
          </template>
        </PField>
        <PField :label="t('components.prop.label')">
          <template #default="{ id }">
            <PInput
              :id="id"
              v-model="draft.label"
              :placeholder="t('components.prop.labelPh')"
              @change="commit({ label: draft.label }, `Changed label of ${draft.name}`)"
            />
          </template>
        </PField>
      </div>
      <p v-if="nameErr" class="-mt-1 text-xs text-danger" role="alert">{{ nameErr }}</p>
      <div class="grid grid-cols-2 gap-2">
        <PField :label="t('components.prop.type')">
          <PSelect
            :model-value="draft.type"
            :options="typeOptions"
            :aria-label="t('components.prop.type')"
            @update:model-value="(v) => v && setType(v)"
          />
        </PField>
        <PField :label="t('components.prop.input')">
          <PSelect
            :model-value="draft.input"
            :options="inputOptions"
            :aria-label="t('components.prop.input')"
            @update:model-value="(v) => v && setInput(v)"
          />
        </PField>
      </div>
      <PField
        v-if="draft.input === 'select'"
        :label="`${t('components.prop.options')} · ${t('components.prop.optionsHint')}`"
      >
        <template #default="{ id }">
          <PInput :id="id" v-model="optsText" placeholder="compact, comfortable" @change="commitOptions" />
        </template>
      </PField>
      <template v-if="hasDefault">
        <div v-if="draft.type === 'Boolean'" class="flex items-center justify-between gap-3">
          <span class="text-sm font-semibold text-fg-2">{{ t('components.prop.default') }}</span>
          <PSwitch
            :model-value="draft.default === true || draft.default === 'true'"
            :label="t('components.prop.default')"
            @update:model-value="(v) => commit({ default: v }, `Changed default of ${draft.name}`)"
          />
        </div>
        <PField v-else :label="t('components.prop.default')">
          <template #default="{ id }">
            <PInput
              :id="id"
              v-model="defText"
              mono
              :placeholder="DEF_PH[draft.type]"
              @change="commitDefault"
            />
          </template>
        </PField>
      </template>
      <label class="flex cursor-pointer items-center gap-2.5">
        <PSwitch
          :model-value="draft.required"
          @update:model-value="
            (v) => commit({ required: v }, `${v ? 'Made required' : 'Made optional'}: ${draft.name}`)
          "
        />
        <span>
          <span class="block text-base font-semibold">{{ t('components.prop.required') }}</span>
          <span class="block text-xs text-faint">{{ t('components.prop.requiredHint') }}</span>
        </span>
      </label>
      <label class="flex cursor-pointer items-center gap-2.5">
        <PSwitch
          :model-value="!!draft.ai"
          @update:model-value="
            (v) =>
              commit(
                { ai: v || undefined },
                `${v ? 'Allowed' : 'Disallowed'} Studio AI to fill ${draft.name}`,
              )
          "
        />
        <span>
          <span class="block text-base font-semibold">{{ t('components.prop.ai') }}</span>
          <span class="block text-xs text-faint">{{ t('components.prop.aiHint') }}</span>
        </span>
      </label>
      <div v-if="!isNew" class="flex justify-end">
        <PButton variant="danger" size="sm" :icon="Trash2" @click="emit('remove')">{{
          t('components.prop.remove')
        }}</PButton>
      </div>
      <div v-else class="flex justify-end gap-1.5">
        <PButton size="sm" @click="emit('cancel')">{{ t('components.prop.cancel') }}</PButton>
        <PButton size="sm" variant="primary" :disabled="!name.trim() || !!nameErr" @click="add">{{
          t('components.prop.create')
        }}</PButton>
      </div>
    </fieldset>
  </div>
</template>
