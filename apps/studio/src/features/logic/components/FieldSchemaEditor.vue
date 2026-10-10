<script setup lang="ts">
/**
 * Typed field list (name · type · required) with nested fields for object / array<object>,
 * to any depth. Used for function params and return values, API request/response and queue messages.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Asterisk, CornerDownRight, Plus, Trash2 } from 'lucide-vue-next'
import { isNested, type TypedField } from '@platon/definition'
import { cn, PSelect, type SelectOption } from '@platon/ui'

defineOptions({ name: 'FieldSchemaEditor' })

const props = withDefaults(
  defineProps<{
    fields: TypedField[]
    types: readonly string[]
    /** Names that are fixed (e.g. REST path params): no rename/delete, always required. */
    locked?: string[]
    depth?: number
    addLabel?: string
    emptyText?: string
    readonly?: boolean
    /** Hide “Add field” (e.g. path params come from the path). */
    noAdd?: boolean
  }>(),
  { depth: 0, locked: () => [] },
)
const emit = defineEmits<{ update: [fields: TypedField[]] }>()
const { t } = useI18n()

const typeOptions = computed<SelectOption<string>[]>(() => props.types.map((x) => ({ value: x, label: x })))

function set(i: number, patch: Partial<TypedField>) {
  const next = props.fields.slice()
  const cur = next[i]!
  const merged: TypedField = { ...cur, ...patch }
  if (patch.type !== undefined) {
    if (isNested(patch.type))
      merged.fields = cur.fields?.length ? cur.fields : [{ name: 'field', type: 'string', req: true }]
    else delete merged.fields
    if (patch.type !== 'enum') delete merged.values
  }
  next[i] = merged
  emit('update', next)
}

function rename(i: number, v: string) {
  set(i, { name: v.replace(/[^A-Za-z0-9_-]/g, '_') })
}

function remove(i: number) {
  emit(
    'update',
    props.fields.filter((_, j) => j !== i),
  )
}

function add() {
  const taken = new Set(props.fields.map((f) => f.name))
  let name = 'field'
  for (let n = 2; taken.has(name); n++) name = `field${n}`
  emit('update', [...props.fields, { name, type: 'string', req: true }])
}

const isLocked = (f: TypedField) => props.locked.includes(f.name)
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-if="depth === 0 && fields.length"
      class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px_28px] gap-1.5 px-0.5 text-2xs font-bold uppercase tracking-wide text-faint-2"
    >
      <span>{{ t('logic.schema.name') }}</span
      ><span>{{ t('logic.schema.type') }}</span
      ><span class="text-center">{{ t('logic.schema.req') }}</span
      ><span />
    </div>
    <div
      v-if="!fields.length && emptyText"
      class="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-faint"
    >
      {{ emptyText }}
    </div>
    <template v-for="(f, i) in fields" :key="i">
      <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px_28px] items-center gap-1.5">
        <div class="flex min-w-0 items-center gap-1">
          <CornerDownRight v-if="depth" :size="12" class="shrink-0 text-faint-2" />
          <span
            v-if="isLocked(f) || readonly"
            class="flex h-[30px] min-w-0 flex-1 items-center truncate rounded-[9px] bg-subtle px-2 font-mono text-sm text-fg-2"
            >{{ isLocked(f) ? ':' : '' }}{{ f.name }}</span
          >
          <input
            v-else
            :value="f.name"
            class="h-[30px] min-w-0 flex-1 rounded-[9px] border border-line bg-surface px-2 font-mono text-sm outline-none focus:border-primary focus:shadow-focus"
            :aria-label="t('logic.schema.name')"
            @change="rename(i, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <PSelect
          size="sm"
          class="font-mono"
          :model-value="f.type"
          :options="typeOptions"
          :disabled="readonly"
          :aria-label="t('logic.schema.type')"
          @update:model-value="(v) => v && set(i, { type: v })"
        />
        <button
          type="button"
          :disabled="isLocked(f) || readonly"
          :class="
            cn(
              'grid size-7 place-items-center rounded-md',
              f.req || isLocked(f) ? 'bg-primary-tint text-primary-strong' : 'text-faint-2 hover:bg-hover',
              'disabled:cursor-default',
            )
          "
          :title="
            isLocked(f)
              ? t('logic.schema.pathRequired')
              : f.req
                ? t('logic.schema.required')
                : t('logic.schema.optional')
          "
          :aria-pressed="f.req"
          @click="set(i, { req: !f.req })"
        >
          <Asterisk :size="13" />
        </button>
        <button
          v-if="!isLocked(f) && !readonly"
          type="button"
          class="grid size-7 place-items-center rounded-md text-faint hover:bg-danger-bg hover:text-danger"
          :title="t('logic.schema.remove')"
          @click="remove(i)"
        >
          <Trash2 :size="13" />
        </button>
        <span v-else />
      </div>
      <input
        v-if="f.type === 'enum' && !readonly"
        :value="(f.values ?? []).join(', ')"
        :placeholder="t('logic.schema.enumValues')"
        class="ml-4 h-[28px] rounded-[8px] border border-line bg-surface px-2 font-mono text-xs outline-none focus:border-primary"
        @change="
          set(i, {
            values: ($event.target as HTMLInputElement).value
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
          })
        "
      />
      <div v-if="isNested(f.type)" class="ml-3 border-l border-line-soft pl-2">
        <FieldSchemaEditor
          :fields="f.fields ?? []"
          :types="types"
          :depth="depth + 1"
          :readonly="readonly"
          :add-label="t('logic.schema.addNested', { name: f.name })"
          @update="set(i, { fields: $event })"
        />
      </div>
    </template>
    <button
      v-if="!readonly && !noAdd"
      type="button"
      class="mt-0.5 inline-flex h-7 items-center gap-1 self-start rounded-md px-1.5 text-sm font-semibold text-primary-strong hover:bg-primary-tint"
      @click="add"
    >
      <Plus :size="13" />{{ addLabel ?? t('logic.schema.add') }}
    </button>
  </div>
</template>
