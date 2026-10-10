<script setup lang="ts">
/** "Inputs preview": the inputs page builders get for each prop; edits here are sample values only. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PColorInput, PInput, PSelect, PSlider, PSwitch, PTextarea } from '@platon/ui'
import type { ComponentProp, CustomComponent } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { valueOf } from './sfc'

const props = defineProps<{ component: CustomComponent; values: Record<string, unknown> }>()
const emit = defineEmits<{ set: [name: string, value: unknown] }>()
const { t } = useI18n()
const def = useDefinitionStore()

const RECORDS = ['Current record', 'Selected table row', 'Signed-in user']
const tables = computed(() => def.definition?.data.tables.map((x) => x.name) ?? [])

function options(p: ComponentProp): string[] {
  if (p.input === 'select') return p.options ?? []
  if (p.input === 'record') return RECORDS
  if (p.input === 'source') {
    const d = typeof p.default === 'string' && p.default ? [p.default] : []
    return [...new Set([...d, ...tables.value])]
  }
  return []
}

const rows = computed(() =>
  props.component.props.map((p) => {
    const opts = options(p)
    let v = valueOf(p, props.values)
    if (opts.length && !opts.includes(String(v))) v = opts[0]
    return { p, opts: opts.map((o) => ({ value: o, label: o })), v }
  }),
)

const str = (v: unknown) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v))
const num = (v: unknown) => Number(v) || 0
const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : '#4f5bea')
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto px-3.5 pb-5 pt-3.5 scroll-thin">
    <div
      v-if="!component.props.length"
      class="rounded-[10px] border border-dashed border-line px-3 py-[18px] text-center text-sm text-faint"
    >
      {{ t('components.inputs.none') }}
    </div>
    <div v-for="{ p, opts, v } in rows" :key="p.name" class="flex flex-col gap-1.5">
      <div class="flex items-baseline gap-1">
        <span class="text-sm font-semibold">{{ p.label || p.name }}</span>
        <span v-if="p.required" class="font-bold text-danger">*</span>
        <span class="ml-auto font-mono text-2xs text-faint">{{ p.name }}</span>
      </div>
      <PInput
        v-if="p.input === 'text'"
        :model-value="str(v)"
        :aria-label="p.label"
        @update:model-value="emit('set', p.name, $event)"
      />
      <PInput
        v-else-if="p.input === 'number'"
        type="number"
        :model-value="num(v)"
        :aria-label="p.label"
        @update:model-value="
          emit('set', p.name, $event === '' || $event == null ? undefined : Number($event))
        "
      />
      <PColorInput
        v-else-if="p.input === 'color'"
        :model-value="hex(v)"
        @update:model-value="emit('set', p.name, $event)"
      />
      <PTextarea
        v-else-if="p.input === 'textarea' || p.input === 'json' || p.input === 'list'"
        :model-value="str(v)"
        :mono="p.input !== 'textarea'"
        rows="3"
        :placeholder="
          p.input === 'list'
            ? t('components.inputs.listPh')
            : p.input === 'json'
              ? p.type === 'Array'
                ? '[ ]'
                : '{ }'
              : ''
        "
        :aria-label="p.label"
        @update:model-value="emit('set', p.name, $event)"
      />
      <PSelect
        v-else-if="opts.length"
        :model-value="String(v)"
        :options="opts"
        :aria-label="p.label"
        @update:model-value="emit('set', p.name, $event)"
      />
      <label v-else-if="p.input === 'toggle'" class="flex cursor-pointer items-center gap-2.5">
        <PSwitch
          :model-value="v === true"
          :label="p.label"
          @update:model-value="emit('set', p.name, $event)"
        />
        <span class="text-sm text-fg-2">{{
          v === true ? t('components.inputs.on') : t('components.inputs.off')
        }}</span>
      </label>
      <div v-else-if="p.input === 'slider'" class="flex items-center gap-2.5">
        <PSlider
          class="flex-1"
          :min="0"
          :max="10"
          :model-value="num(v)"
          :label="p.label"
          @update:model-value="emit('set', p.name, $event)"
        />
        <span class="w-6 text-right font-mono text-sm">{{ num(v) }}</span>
      </div>
      <PInput
        v-else
        :model-value="str(v)"
        :aria-label="p.label"
        @update:model-value="emit('set', p.name, $event)"
      />
      <div class="text-2xs text-faint">
        {{ t(`components.inputKind.${p.input}`)
        }}<template v-if="p.input === 'source'"> · {{ t('components.inputs.fromTable') }}</template>
      </div>
    </div>
  </div>
</template>
