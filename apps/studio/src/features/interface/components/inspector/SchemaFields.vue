<script setup lang="ts">
/** Content settings declared in the block catalog (BlockMeta.fields) instead of a hand-written template. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PField, PInput, PSelect, PSwitch, PTextarea } from '@platon/ui'
import { listProp, type Block, type Page, type PropField } from '@platon/definition'
import { useInterfaceEdits } from '../../composables/useInterfaceEdits'

const props = defineProps<{ page: Page; block: Block; fields: PropField[] }>()
const { t } = useI18n()
const edits = useInterfaceEdits()
const P = computed(() => props.block.props as Record<string, unknown>)

const valueOf = (f: PropField) => P.value[f.key] ?? f.def
const shown = computed(() =>
  props.fields.filter((f) => !f.when || f.when.is.includes(P.value[f.when.key] as string)),
)
const text = (v: unknown) =>
  v === undefined || v === null ? '' : Array.isArray(v) ? v.join(', ') : String(v)

// Local buffers so typing isn't one change per keystroke; they commit on change (blur / Enter).
const buf = ref<Record<string, string>>({})
watch(
  () => [props.block, props.fields] as const,
  () => (buf.value = Object.fromEntries(props.fields.map((f) => [f.key, text(valueOf(f))]))),
  { immediate: true },
)

function set(f: PropField, value: unknown) {
  const v = value === '' ? undefined : value
  edits.blockField(
    props.page,
    props.block,
    ['props', f.key],
    v,
    t('interface.f.propChanged', { prop: f.label }),
  )
}
function commit(f: PropField) {
  // A number input's v-model hands back a number, not the string the buffer started with.
  const raw = String(buf.value[f.key] ?? '')
  if (f.input === 'list') return set(f, raw.trim() ? listProp(raw) : undefined)
  if (f.input !== 'number') return set(f, raw)
  if (raw.trim() === '') return set(f, undefined)
  const n = Number(raw)
  if (!Number.isFinite(n)) return
  set(f, Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, n)))
}
</script>

<template>
  <PField v-for="f in shown" :key="f.key" :label="f.label" :hint="f.hint" v-slot="{ id }">
    <PSwitch
      v-if="f.input === 'switch'"
      :id="id"
      :model-value="valueOf(f) === true"
      @update:model-value="set(f, $event)"
    />
    <PSelect
      v-else-if="f.input === 'select'"
      :id="id"
      :model-value="text(valueOf(f))"
      :options="(f.options ?? []).map(([value, label]) => ({ value, label }))"
      @update:model-value="set(f, $event)"
    />
    <PTextarea
      v-else-if="f.input === 'textarea'"
      :id="id"
      v-model="buf[f.key]"
      :rows="3"
      @change="commit(f)"
    />
    <PInput
      v-else
      :id="id"
      v-model="buf[f.key]"
      :type="f.input === 'number' ? 'number' : 'text'"
      :min="f.min"
      :max="f.max"
      @change="commit(f)"
    />
  </PField>
</template>
