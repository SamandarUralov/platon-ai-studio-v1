<script setup lang="ts">
/** Table structure editor. Every edit is a definition change (and so a migration in the next release). */
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, Ellipsis, GripVertical, KeyRound, Plus, Trash2 } from 'lucide-vue-next'
import { PButton, PCheckbox, PIcon, PInput, PMenu, PSelect, PSwitch, type MenuEntry } from '@platon/ui'
import { FIELD_TYPES, type Table, type TableField, type TableFieldType } from '@platon/definition'
import {
  addFieldChange,
  changeTypeChange,
  moveFieldChange,
  newFieldKey,
  removeFieldChange,
  setFieldPropChange,
} from '../lib/model'
import { useData } from '../composables/useDataModel'
import { FIELD_TYPE_OPTIONS } from './fieldTypes'

const props = defineProps<{ table: Table }>()
const selected = defineModel<string | null>('selected', { default: null })
const { t } = useI18n()
const m = useData()
const GRID = 'grid-cols-[28px_minmax(0,1.4fr)_170px_84px_70px_minmax(0,1fr)_40px]'

// ── add
const adding = ref(false)
const newName = ref('')
const newType = ref<TableFieldType>('text')
const nameInput = ref<InstanceType<typeof PInput>>()
async function startAdd() {
  adding.value = true
  await nextTick()
  nameInput.value?.focus()
}
defineExpose({ startAdd })
function add() {
  const name = newName.value.trim()
  if (!name) return
  const f: TableField = { key: newFieldKey(name, props.table), name, type: newType.value }
  if (f.type === 'link')
    f.link =
      m.tables.value.find((x) => x.id !== props.table.id && x.connection === props.table.connection)?.id ??
      props.table.id
  if (f.type === 'single_select' || f.type === 'multi_select') f.options = ['Option 1', 'Option 2']
  if (m.edit(addFieldChange(props.table, f))) {
    selected.value = f.key
    newName.value = ''
    adding.value = false
  }
}

// ── edits
function rename(f: TableField, e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  if (v && v !== f.name)
    m.edit(
      setFieldPropChange(
        props.table,
        f,
        'name',
        v,
        `Renamed field “${f.name}” to “${v}” in ${props.table.name}`,
      ),
    )
  else (e.target as HTMLInputElement).value = f.name
}
const defaultLink = computed(
  () => m.tables.value.find((x) => x.id !== props.table.id && x.connection === props.table.connection)?.id,
)
const setType = (f: TableField, type: TableFieldType | undefined) =>
  type && type !== f.type && m.edit(changeTypeChange(props.table, f, type, defaultLink.value))
const move = (f: TableField, to: number) =>
  to >= 0 && to < props.table.fields.length && m.edit(moveFieldChange(props.table, f, to))
const linkOptions = computed(() => m.tables.value.map((x) => ({ value: x.id, label: x.name })))

const menu = (f: TableField, i: number): MenuEntry[] => [
  { label: t('data.fields.moveUp'), icon: ArrowUp, disabled: i === 0, onSelect: () => move(f, i - 1) },
  {
    label: t('data.fields.moveDown'),
    icon: ArrowDown,
    disabled: i === props.table.fields.length - 1,
    onSelect: () => move(f, i + 1),
  },
  { type: 'separator' },
  {
    label: t('data.fields.delete'),
    icon: Trash2,
    danger: true,
    onSelect: () => {
      if (
        m.edit(removeFieldChange(props.table, f), t('data.fields.deleted', { name: f.name })) &&
        selected.value === f.key
      )
        selected.value = null
    },
  },
]

// ── drag to reorder (handle only, so inputs keep text selection)
const dragKey = ref<string | null>(null)
const overIndex = ref<number | null>(null)
function onDrop(i: number) {
  const f = props.table.fields.find((x) => x.key === dragKey.value)
  if (f && props.table.fields.indexOf(f) !== i) move(f, i)
  dragKey.value = null
  overIndex.value = null
}
const records = computed(() => m.count(props.table.id) ?? 0)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-if="adding"
      class="flex flex-wrap items-end gap-2.5 rounded-xl border border-primary-ring bg-primary-tint/40 p-3.5"
    >
      <label class="min-w-[180px] flex-1">
        <span class="mb-1.5 block text-xs font-semibold text-fg-2">{{ t('data.fields.name') }}</span>
        <PInput
          ref="nameInput"
          v-model="newName"
          :placeholder="t('data.fields.namePh')"
          @keydown.enter="add"
          @keydown.esc="adding = false"
        />
      </label>
      <label class="w-[190px]">
        <span class="mb-1.5 block text-xs font-semibold text-fg-2">{{ t('data.fields.type') }}</span>
        <PSelect v-model="newType" :options="FIELD_TYPE_OPTIONS" :aria-label="t('data.fields.type')" />
      </label>
      <PButton variant="primary" size="md" :disabled="!newName.trim()" @click="add">{{
        t('data.fields.add')
      }}</PButton>
      <PButton size="md" @click="adding = false">{{ t('data.fields.cancel') }}</PButton>
      <p class="basis-full text-xs text-muted">{{ t('data.fields.addNote', { n: records }) }}</p>
    </div>

    <div class="overflow-x-auto rounded-xl border border-line-2 bg-surface">
      <div class="min-w-[760px]">
        <div :class="['grid border-b border-line-soft bg-subtle-2 text-xs font-semibold text-muted', GRID]">
          <span />
          <div class="px-3 py-2.5">{{ t('data.fields.field') }}</div>
          <div class="px-3 py-2.5">{{ t('data.fields.type') }}</div>
          <div class="px-3 py-2.5">{{ t('data.fields.required') }}</div>
          <div class="px-3 py-2.5">{{ t('data.fields.unique') }}</div>
          <div class="px-3 py-2.5">{{ t('data.fields.details') }}</div>
          <span />
        </div>
        <!-- implicit primary key -->
        <div :class="['grid items-center border-b border-line-faint text-base text-muted', GRID]">
          <span class="grid place-items-center"><KeyRound :size="13" class="text-warn-dot" /></span>
          <div class="px-3 py-2"><span class="font-mono text-sm">id</span></div>
          <div class="px-3 py-2 text-sm">{{ t('data.fields.pk') }}</div>
          <div class="px-3 py-2 text-sm">✓</div>
          <div class="px-3 py-2 text-sm">✓</div>
          <div class="px-3 py-2" />
          <span />
        </div>
        <div
          v-for="(f, i) in table.fields"
          :key="f.key"
          :class="[
            'group grid items-center border-b border-line-faint text-base last:border-b-0',
            GRID,
            selected === f.key ? 'bg-primary-tint/50' : 'hover:bg-hover',
            overIndex === i && dragKey && dragKey !== f.key
              ? 'shadow-[inset_0_2px_0_var(--color-primary)]'
              : '',
            dragKey === f.key ? 'opacity-50' : '',
          ]"
          @click="selected = f.key"
          @dragover.prevent="overIndex = i"
          @drop.prevent="onDrop(i)"
        >
          <span
            class="grid h-full cursor-grab place-items-center text-faint-2 hover:text-fg"
            draggable="true"
            :title="t('data.fields.dragHint')"
            @dragstart="
              (e) => {
                dragKey = f.key
                e.dataTransfer?.setData('text/plain', f.key)
              }
            "
            @dragend="
              dragKey = null
              overIndex = null
            "
          >
            <GripVertical :size="14" />
          </span>
          <div class="min-w-0 px-2 py-1.5">
            <input
              :value="f.name"
              class="h-7 w-full rounded-md border border-transparent bg-transparent px-1.5 font-semibold outline-none hover:border-line focus:border-primary focus:bg-surface"
              :aria-label="t('data.fields.name')"
              @change="rename(f, $event)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
            <div class="truncate px-1.5 font-mono text-2xs text-faint">{{ f.key }}</div>
          </div>
          <div class="px-2" @click.stop>
            <PSelect
              :model-value="f.type"
              :options="FIELD_TYPE_OPTIONS"
              size="sm"
              :aria-label="t('data.fields.type')"
              @update:model-value="(v) => setType(f, v)"
            />
          </div>
          <div class="px-3" @click.stop>
            <PSwitch
              :model-value="!!f.req"
              size="sm"
              :label="t('data.fields.required')"
              @update:model-value="(v) => m.edit(setFieldPropChange(table, f, 'req', v || undefined))"
            />
          </div>
          <div class="px-3" @click.stop>
            <PCheckbox
              :model-value="!!f.unique"
              :aria-label="t('data.fields.unique')"
              @update:model-value="
                (v) => m.edit(setFieldPropChange(table, f, 'unique', v === true || undefined))
              "
            />
          </div>
          <div class="min-w-0 px-2 text-sm text-muted">
            <div v-if="f.type === 'link'" @click.stop>
              <PSelect
                :model-value="f.link"
                :options="linkOptions"
                size="sm"
                :aria-label="t('data.fields.linkTo')"
                @update:model-value="(v) => v && m.edit(setFieldPropChange(table, f, 'link', v))"
              />
            </div>
            <span v-else-if="f.options?.length" class="block truncate" :title="f.options.join(', ')">{{
              f.options.join(', ')
            }}</span>
            <span v-else-if="f.workflow" class="inline-flex items-center gap-1"
              ><PIcon name="workflow" :size="12" />{{ f.workflow }}</span
            >
            <span v-else-if="f.storage" class="inline-flex items-center gap-1"
              ><PIcon name="hard-drive" :size="12" />{{ f.storage }}</span
            >
            <span v-else class="inline-flex items-center gap-1 font-mono text-xs text-faint"
              ><PIcon :name="FIELD_TYPES[f.type].icon" :size="12" />{{ FIELD_TYPES[f.type].sql }}</span
            >
          </div>
          <div class="flex justify-center" @click.stop>
            <PMenu :items="menu(f, i)" :width="190">
              <PButton
                square
                size="xs"
                variant="ghost"
                :icon="Ellipsis"
                :label="f.name"
                class="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              />
            </PMenu>
          </div>
        </div>
      </div>
    </div>
    <button
      v-if="!adding"
      type="button"
      class="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm font-semibold text-muted hover:border-primary-ring hover:text-primary-strong"
      @click="startAdd"
    >
      <Plus :size="14" />{{ t('data.fields.add') }}
    </button>
  </div>
</template>
