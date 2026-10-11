<script setup lang="ts">
/** Content settings per block type. Text inputs commit on change (blur / Enter) so typing is one change. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ExternalLink, Pencil } from 'lucide-vue-next'
import {
  PBadge,
  PButton,
  PColorInput,
  PField,
  PInput,
  PSelect,
  PSlider,
  PSwitch,
  PTextarea,
} from '@platon/ui'
import { BLOCKS, CHART_TYPES, type Block, type ComponentProp, type Page } from '@platon/definition'
import { KIT_PACKAGE, STATS } from '@platon/renderer'
import { useDefinitionStore } from '@/stores/definition'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useInterfaceEdits } from '../../composables/useInterfaceEdits'
import ChipToggle from './ChipToggle.vue'
import SchemaFields from './SchemaFields.vue'

const props = defineProps<{ page: Page; block: Block }>()
const { t } = useI18n()
const def = useDefinitionStore()
const edits = useInterfaceEdits()
const router = useRouter()
const pid = useProjectId()

const P = computed(() => props.block.props as Record<string, unknown>)
const type = computed(() => props.block.type)
const meta = computed(() => BLOCKS[type.value])
const has = (...ts: Block['type'][]) => ts.includes(type.value)
const isChart = computed(() => CHART_TYPES.includes(type.value))
const str = (v: unknown) => (v === undefined || v === null ? '' : Array.isArray(v) ? v.join(', ') : String(v))

function setProp(key: string, value: unknown, label: string) {
  edits.blockField(props.page, props.block, ['props', key], value === '' ? undefined : value, label)
}
function setTitle(v: string) {
  edits.blockField(props.page, props.block, ['title'], v.trim() || undefined, t('interface.f.titleChanged'))
}

// Local text buffers so the inspector doesn't fight the user while typing.
const buf = ref<Record<string, string>>({})
watch(
  () => props.block,
  (b) => {
    const p = b.props as Record<string, unknown>
    buf.value = {
      title: b.title ?? '',
      ref: b.ref,
      ...Object.fromEntries(
        [
          'subtitle',
          'buttonLabel',
          'text',
          'src',
          'label',
          'submitLabel',
          'placeholder',
          'help',
          'options',
          'tabs',
          'steps',
          'total',
          'pageSize',
        ].map((k) => [k, str(p[k])]),
      ),
    }
  },
  { immediate: true },
)

const tables = computed(() => def.definition?.data.tables ?? [])
const table = computed(() => tables.value.find((x) => x.id === P.value.source))
const tableOptions = computed(() => tables.value.map((x) => ({ value: x.id, label: x.name })))
const fieldOptions = computed(() => (table.value?.fields ?? []).map((f) => ({ value: f.key, label: f.name })))
const columns = computed(() => (Array.isArray(P.value.columns) ? (P.value.columns as string[]) : []))
const whoOptions = computed(() => [
  { value: 'everyone', label: t('interface.f.who.everyone') },
  { value: 'staff', label: t('interface.f.who.staff') },
  ...(def.definition?.roles ?? []).map((r) => ({
    value: r.id,
    label: t('interface.f.who.only', { role: r.name }),
  })),
  { value: 'nobody', label: t('interface.f.who.nobody') },
])
const filterOptions = computed(() =>
  ['none', 'open', 'mine'].map((v) => ({ value: v, label: t(`interface.f.filter.${v}`) })),
)
const statOptions = computed(() => Object.entries(STATS).map(([k, s]) => ({ value: k, label: s.label })))
const actionOptions = computed(() =>
  ['none', 'navigate', 'form', 'call'].map((v) => ({ value: v, label: t(`interface.f.action.${v}`) })),
)
const variantOptions = computed(() => (meta.value.variants ?? []).map(([value, label]) => ({ value, label })))
const listOf = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

const refErr = computed(() => {
  const v = buf.value.ref ?? ''
  if (!/^[a-z][A-Za-z0-9]*$/.test(v)) return t('interface.f.refInvalid')
  if (props.page.blocks.some((b) => b.id !== props.block.id && b.ref === v)) return t('interface.f.refTaken')
  return null
})
function saveRef() {
  if (refErr.value || buf.value.ref === props.block.ref) return
  edits.blockField(props.page, props.block, ['ref'], buf.value.ref, t('interface.f.refChanged'))
}

// custom components
const component = computed(() =>
  type.value === 'custom'
    ? def.definition?.components.find((c) => c.id === props.block.component)
    : undefined,
)
function propValue(p: ComponentProp) {
  return P.value[p.name] ?? p.default ?? ''
}
function setCustom(p: ComponentProp, v: unknown) {
  setProp(p.name, v, t('interface.f.propChanged', { prop: p.label }))
}
</script>

<template>
  <div class="space-y-3.5">
    <!-- custom component -->
    <template v-if="type === 'custom'">
      <div class="flex items-center gap-2 rounded-lg bg-subtle px-2.5 py-2 text-sm">
        <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{
          component?.file ?? t('interface.f.missingComponent')
        }}</span>
        <PButton
          v-if="component"
          size="xs"
          variant="ghost"
          :icon="Pencil"
          @click="router.push(projectLinks(pid).components(component.id))"
          >{{ t('interface.f.editComponent') }}</PButton
        >
      </div>
      <p v-if="component && !component.props.length" class="text-sm text-faint">
        {{ t('interface.f.noInputs') }}
      </p>
      <PField
        v-for="p in component?.props ?? []"
        :key="p.name"
        :label="p.label"
        :required="p.required"
        :hint="p.name"
      >
        <PSwitch
          v-if="p.input === 'toggle'"
          :model-value="propValue(p) === true || propValue(p) === 'true'"
          @update:model-value="setCustom(p, $event)"
        />
        <PColorInput
          v-else-if="p.input === 'color'"
          :model-value="String(propValue(p) || '#0e7c66')"
          @update:model-value="setCustom(p, $event)"
        />
        <PSelect
          v-else-if="p.input === 'select'"
          :model-value="String(propValue(p))"
          :options="(p.options ?? []).map((o) => ({ value: o, label: o }))"
          @update:model-value="setCustom(p, $event)"
        />
        <PSlider
          v-else-if="p.input === 'slider'"
          :model-value="Number(propValue(p)) || 0"
          @update:model-value="setCustom(p, $event)"
        />
        <PTextarea
          v-else-if="['textarea', 'json', 'list', 'record'].includes(p.input)"
          :model-value="
            typeof propValue(p) === 'string' ? String(propValue(p)) : JSON.stringify(propValue(p))
          "
          :rows="3"
          @change="setCustom(p, ($event.target as HTMLTextAreaElement).value)"
        />
        <PSelect
          v-else-if="p.input === 'source'"
          :model-value="String(propValue(p))"
          :options="tableOptions"
          @update:model-value="setCustom(p, $event)"
        />
        <PInput
          v-else
          :model-value="String(propValue(p))"
          :type="p.input === 'number' ? 'number' : 'text'"
          @change="
            setCustom(
              p,
              p.input === 'number'
                ? Number(($event.target as HTMLInputElement).value)
                : ($event.target as HTMLInputElement).value,
            )
          "
        />
      </PField>
    </template>

    <PField
      v-if="!meta.noTitle && !has('text', 'stats', 'steps')"
      :label="
        has('header')
          ? t('interface.f.heading')
          : has('button')
            ? t('interface.f.buttonName')
            : has(
                  'input',
                  'select',
                  'checkbox',
                  'radio',
                  'switch',
                  'date',
                  'textarea',
                  'upload',
                  'segmented',
                  'richtext',
                )
              ? t('interface.f.label')
              : t('interface.f.title')
      "
      v-slot="{ id }"
    >
      <PInput :id="id" v-model="buf.title" @change="setTitle(buf.title!)" />
    </PField>

    <!-- header -->
    <template v-if="has('header')">
      <PField :label="t('interface.f.subtitle')" v-slot="{ id }"
        ><PInput
          :id="id"
          v-model="buf.subtitle"
          @change="setProp('subtitle', buf.subtitle, t('interface.f.subtitleChanged'))"
      /></PField>
      <PField :label="t('interface.f.buttonLabel')" v-slot="{ id }"
        ><PInput
          :id="id"
          v-model="buf.buttonLabel"
          @change="setProp('buttonLabel', buf.buttonLabel, t('interface.f.buttonChanged'))"
      /></PField>
      <PField v-if="P.buttonLabel" :label="t('interface.f.buttonWho')">
        <PSelect
          :model-value="str(P.buttonWho) || 'everyone'"
          :options="whoOptions"
          @update:model-value="setProp('buttonWho', $event, t('interface.f.buttonWhoChanged'))"
        />
      </PField>
    </template>

    <!-- text / image / button -->
    <PField v-if="has('text', 'alert')" :label="t('interface.f.text')" v-slot="{ id }"
      ><PTextarea
        :id="id"
        v-model="buf.text"
        :rows="4"
        @change="setProp('text', buf.text, t('interface.f.textChanged'))"
    /></PField>
    <template v-if="type === 'image'">
      <PField :label="t('interface.f.src')" :hint="t('interface.f.srcHint')">
        <PInput
          v-model="buf.src"
          mono
          :placeholder="'https://'"
          :aria-label="t('interface.f.src')"
          @change="setProp('src', buf.src, t('interface.f.srcChanged'))"
        />
      </PField>
    </template>
    <template v-if="has('button')">
      <PField :label="t('interface.f.buttonText')" v-slot="{ id }"
        ><PInput
          :id="id"
          v-model="buf.label"
          @change="setProp('label', buf.label, t('interface.f.buttonChanged'))"
      /></PField>
      <PField :label="t('interface.f.whenClicked')" :hint="t('interface.f.whenClickedHint')">
        <PSelect
          :model-value="str(P.action) || 'none'"
          :options="actionOptions"
          @update:model-value="setProp('action', $event, t('interface.f.actionChanged'))"
        />
      </PField>
    </template>

    <!-- UI kit -->
    <div v-if="meta.kit" class="flex items-center gap-2 text-xs text-muted">
      <PBadge size="xs" tone="teal">{{ t('interface.f.kit') }}</PBadge
      >{{ meta.label }}
      <a
        class="ml-auto inline-flex items-center gap-1 font-semibold text-primary-strong hover:underline"
        :href="`https://www.npmjs.com/package/${KIT_PACKAGE}`"
        target="_blank"
        rel="noopener"
        >npm<ExternalLink :size="11"
      /></a>
    </div>
    <PField v-if="variantOptions.length" :label="t('interface.f.variant')">
      <PSelect
        :model-value="str(P.variant) || variantOptions[0]!.value"
        :options="variantOptions"
        @update:model-value="setProp('variant', $event, t('interface.f.variantChanged'))"
      />
    </PField>
    <PField v-if="has('input', 'textarea', 'select')" :label="t('interface.f.placeholder')" v-slot="{ id }"
      ><PInput
        :id="id"
        v-model="buf.placeholder"
        @change="setProp('placeholder', buf.placeholder, t('interface.f.placeholderChanged'))"
    /></PField>
    <PField v-if="has('input')" :label="t('interface.f.help')" v-slot="{ id }"
      ><PInput :id="id" v-model="buf.help" @change="setProp('help', buf.help, t('interface.f.helpChanged'))"
    /></PField>
    <PField v-if="has('switch')" :label="t('interface.f.description')" v-slot="{ id }"
      ><PInput :id="id" v-model="buf.text" @change="setProp('text', buf.text, t('interface.f.textChanged'))"
    /></PField>
    <PField
      v-if="has('select', 'radio', 'checkbox', 'segmented')"
      :label="t('interface.f.options')"
      :hint="t('interface.f.commaHint')"
      v-slot="{ id }"
    >
      <PInput
        :id="id"
        v-model="buf.options"
        @change="setProp('options', listOf(buf.options!), t('interface.f.optionsChanged'))"
      />
    </PField>
    <PField
      v-if="has('tabs')"
      :label="t('interface.f.tabs')"
      :hint="t('interface.f.commaHint')"
      v-slot="{ id }"
      ><PInput
        :id="id"
        v-model="buf.tabs"
        @change="setProp('tabs', listOf(buf.tabs!), t('interface.f.optionsChanged'))"
    /></PField>
    <PField
      v-if="has('steps')"
      :label="t('interface.f.steps')"
      :hint="t('interface.f.commaHint')"
      v-slot="{ id }"
      ><PInput
        :id="id"
        v-model="buf.steps"
        @change="setProp('steps', listOf(buf.steps!), t('interface.f.optionsChanged'))"
    /></PField>
    <div v-if="has('pagination')" class="grid grid-cols-2 gap-2">
      <PField :label="t('interface.f.total')" v-slot="{ id }"
        ><PInput
          :id="id"
          v-model="buf.total"
          type="number"
          @change="setProp('total', Number(buf.total), t('interface.f.totalChanged'))"
      /></PField>
      <PField :label="t('interface.f.pageSize')" v-slot="{ id }"
        ><PInput
          :id="id"
          v-model="buf.pageSize"
          type="number"
          @change="setProp('pageSize', Number(buf.pageSize), t('interface.f.totalChanged'))"
      /></PField>
    </div>

    <SchemaFields v-if="meta.fields?.length" :page="page" :block="block" :fields="meta.fields" />

    <!-- data -->
    <PField
      v-if="isChart || has('table', 'form', 'list', 'detail', 'calendar', 'kpi')"
      :label="t('interface.f.source')"
    >
      <PSelect
        :model-value="str(P.source)"
        :options="tableOptions"
        :placeholder="t('interface.f.pickTable')"
        @update:model-value="setProp('source', $event, t('interface.f.sourceChanged'))"
      />
    </PField>
    <PField
      v-if="has('table', 'form', 'list', 'detail') && table"
      :label="has('form') ? t('interface.f.fields') : t('interface.f.columns')"
    >
      <ChipToggle
        :model-value="columns"
        :options="fieldOptions"
        @update:model-value="setProp('columns', $event, t('interface.f.columnsChanged'))"
      />
    </PField>
    <PField v-if="isChart && type !== 'scatter' && table" :label="t('interface.f.groupBy')">
      <PSelect
        :model-value="str(P.groupBy)"
        :options="fieldOptions"
        :placeholder="t('interface.f.sample')"
        @update:model-value="setProp('groupBy', $event, t('interface.f.groupChanged'))"
      />
    </PField>
    <PField v-if="has('calendar') && table" :label="t('interface.f.dateField')">
      <PSelect
        :model-value="str(P.dateField)"
        :options="
          fieldOptions.filter((f) =>
            ['date', 'datetime'].includes(table!.fields.find((x) => x.key === f.value)!.type),
          )
        "
        @update:model-value="setProp('dateField', $event, t('interface.f.groupChanged'))"
      />
    </PField>
    <PField v-if="has('table', 'list')" :label="t('interface.f.filter.label')">
      <PSelect
        :model-value="str(P.filter) || 'none'"
        :options="filterOptions"
        @update:model-value="setProp('filter', $event, t('interface.f.filterChanged'))"
      />
    </PField>
    <PField v-if="has('stats')" :label="t('interface.f.numbers')">
      <ChipToggle
        :model-value="Array.isArray(P.items) ? (P.items as string[]) : []"
        :options="statOptions"
        @update:model-value="setProp('items', $event, t('interface.f.numbersChanged'))"
      />
    </PField>
    <PField v-if="has('form')" :label="t('interface.f.submit')" v-slot="{ id }"
      ><PInput
        :id="id"
        v-model="buf.submitLabel"
        @change="setProp('submitLabel', buf.submitLabel, t('interface.f.submitChanged'))"
    /></PField>

    <PField
      :label="t('interface.f.ref')"
      :error="refErr"
      :hint="refErr ? undefined : t('interface.f.refHint', { ref: block.ref })"
      v-slot="{ id }"
    >
      <PInput :id="id" v-model="buf.ref" mono :invalid="!!refErr" @change="saveRef" />
    </PField>
  </div>
</template>
