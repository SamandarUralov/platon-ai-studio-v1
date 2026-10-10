<script setup lang="ts">
/** Method settings (nothing selected): name, description, timeout, parameters and return type. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  formatType,
  isNested,
  walkSteps,
  type LogicFunction,
  type LogicKind,
  type TypedField,
} from '@platon/definition'
import { PField, PInput, PSelect, PTextarea } from '@platon/ui'
import { useDefinitionStore } from '@/stores/definition'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { signature } from '../../lib/infer'
import { fnTypes } from '../../lib/items'
import FieldSchemaEditor from '../FieldSchemaEditor.vue'
import Section from '../Section.vue'
import DeleteItem from '../DeleteItem.vue'

const props = defineProps<{ fn: LogicFunction }>()
const emit = defineEmits<{ edit: [fn: (f: LogicFunction) => LogicFunction]; remove: [] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const router = useRouter()
const pid = useProjectId()

const TIMEOUTS = ['5 s', '10 s', '30 s', '60 s', '5 min'].map((x) => ({ value: x, label: x }))
const types = computed(() => fnTypes(def.definition))
const paramTypes = computed(() => types.value.filter((x) => x !== 'void'))
const secParams = ref(true)
const secRet = ref(true)

function set<K extends keyof LogicFunction>(k: K, v: LogicFunction[K]) {
  emit('edit', (f) => ({ ...f, [k]: v }))
}
function setReturnType(type: string | undefined) {
  if (!type) return
  emit('edit', (f) => ({
    ...f,
    returns: isNested(type)
      ? {
          type,
          fields: f.returns.fields?.length ? f.returns.fields : [{ name: 'ok', type: 'boolean', req: true }],
        }
      : { type },
  }))
}

/** Who calls this function by name (shown so renames and deletes aren't a surprise). */
const usedBy = computed(() => {
  const d = def.definition
  if (!d) return []
  const out: { kind: LogicKind; id: string; label: string }[] = []
  const scan = (kind: LogicKind, id: string, label: string, steps: LogicFunction['steps']) => {
    let hit = false
    walkSteps(steps, (s) => {
      if ((s.type === 'call' || s.type === 'return') && s.config.fn === props.fn.name) hit = true
    })
    if (hit) out.push({ kind, id, label })
  }
  for (const f of d.logic.functions) if (f.id !== props.fn.id) scan('functions', f.id, f.name, f.steps)
  for (const a of d.logic.apis) scan('apis', a.id, `${a.method} ${a.path}`, a.steps)
  for (const c of d.logic.crons) scan('crons', c.id, c.name, c.steps)
  for (const q of d.logic.queues)
    if (q.consumers.includes(props.fn.name))
      out.push({ kind: 'queues', id: q.id, label: `${q.name} · consumer` })
  return out
})
</script>

<template>
  <div class="flex flex-col">
    <div class="border-b border-line-faint px-4 py-3">
      <div class="text-md font-bold">{{ t('logic.fnSettings.title') }}</div>
      <div class="truncate font-mono text-xs text-faint">{{ fn.name }}{{ signature(fn) }}</div>
    </div>

    <div class="flex flex-col gap-3.5 border-b border-line-faint px-4 py-4">
      <PField :label="t('logic.fnSettings.name')" :hint="t('logic.fnSettings.nameHint')">
        <PInput
          mono
          :model-value="fn.name"
          @update:model-value="set('name', String($event ?? '').replace(/[^A-Za-z0-9_]/g, ''))"
        />
      </PField>
      <PField :label="t('logic.fnSettings.description')">
        <PTextarea
          class="min-h-[64px]"
          :model-value="fn.description ?? ''"
          :placeholder="t('logic.fnSettings.descriptionPh')"
          @update:model-value="set('description', $event ?? '')"
        />
      </PField>
      <PField :label="t('logic.fnSettings.timeout')">
        <PSelect
          :model-value="fn.timeout || '10 s'"
          :options="TIMEOUTS"
          @update:model-value="set('timeout', $event ?? '10 s')"
        />
      </PField>
    </div>

    <Section
      v-model:open="secParams"
      :title="t('logic.fnSettings.params')"
      :summary="
        fn.params.map((p) => `${p.name}: ${formatType(p.type, p.fields)}`).join(', ') ||
        t('logic.fnSettings.noParams')
      "
    >
      <FieldSchemaEditor
        :fields="fn.params"
        :types="paramTypes"
        :empty-text="t('logic.fnSettings.noParams')"
        :add-label="t('logic.fnSettings.addParam')"
        @update="(p: TypedField[]) => set('params', p)"
      />
    </Section>

    <Section
      v-model:open="secRet"
      :title="t('logic.fnSettings.returns')"
      :summary="formatType(fn.returns.type, fn.returns.fields)"
    >
      <PField :label="t('logic.schema.type')">
        <PSelect
          class="font-mono"
          :model-value="fn.returns.type"
          :options="types.map((x) => ({ value: x, label: x }))"
          @update:model-value="setReturnType"
        />
      </PField>
      <p class="-mt-1.5 text-xs text-faint">
        {{ fn.returns.type === 'void' ? t('logic.fnSettings.voidHint') : t('logic.fnSettings.retHint') }}
      </p>
      <FieldSchemaEditor
        v-if="isNested(fn.returns.type)"
        :fields="fn.returns.fields ?? []"
        :types="paramTypes"
        @update="(fs: TypedField[]) => set('returns', { ...fn.returns, fields: fs })"
      />
    </Section>

    <Section :title="t('logic.fnSettings.usedBy')" :summary="String(usedBy.length)">
      <p v-if="!usedBy.length" class="text-sm text-faint">{{ t('logic.fnSettings.unused') }}</p>
      <button
        v-for="u in usedBy"
        :key="`${u.kind}/${u.id}`"
        type="button"
        class="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
        @click="router.push(projectLinks(pid).logic(u.kind, u.id))"
      >
        <span class="truncate font-mono">{{ u.label }}</span
        ><span class="text-xs text-faint">{{ t(`logic.kinds.${u.kind}`) }}</span>
      </button>
    </Section>

    <DeleteItem
      :name="fn.name"
      :noun="t('logic.noun.functions')"
      :used-by="usedBy.length"
      @confirm="emit('remove')"
    />
  </div>
</template>
