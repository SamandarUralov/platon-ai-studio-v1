<script setup lang="ts">
/**
 * Form controls rendered with the Platon UI Kit: input, select, checkbox, radio, switch, date,
 * textarea, upload, segmented buttons and rich text. Radio has no kit component yet, so it keeps a
 * token-styled native group.
 */
import { computed, ref } from 'vue'
import {
  KitCheckbox,
  KitDatePicker,
  KitDateRangePicker,
  KitFileUpload,
  KitImageUpload,
  KitInput,
  KitInputFileUpload,
  KitInputSearch,
  KitMultiselectButton,
  KitRichTextEditor,
  KitSelectItem,
  KitSelectWrapper,
  KitSwitch,
  KitTextarea,
  kitVariant,
} from '../kit'
import { type BlockProps, list, str, tr, useResolved } from './props'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const t = computed(() => props.block.type)
const label = computed(() => tr(props, 'title', r.value.title ?? ''))
const opts = computed(() => {
  const o = list(r.value.options)
  return o.length ? o : ['Low', 'Normal', 'High', 'Urgent']
})
// The canvas makes blocks inert, so controls stay enabled there and keep their normal look.
const disabled = computed(() => r.value.disabled === true)
const on = (k: string, d = false) => (r.value[k] === undefined ? d : r.value[k] === true)
const num = (k: string, d: number) =>
  Number.isFinite(Number(r.value[k])) && r.value[k] !== '' ? Number(r.value[k]) : d
const help = computed(() => str(r.value.help) || undefined)
const size = computed(() => (r.value.size === 'compact' ? 'compact' : 'default'))
const locale = computed(() => {
  const l = props.ctx.lang ?? props.ctx.definition.settings.defaultLanguage ?? 'en'
  return l.includes('-') ? l : `${l}-${l === 'en' ? 'US' : l.toUpperCase()}`
})

const text = ref(str(r.value.value))
const selected = ref<unknown>(on('multiple') ? [] : undefined)
const picked = ref<string[]>([])
const checked = ref(r.value.checked === true)
const date = ref<unknown>(undefined)
const files = ref<File[]>([])
const image = ref<string | File | undefined>(undefined)
const html = ref(str(r.value.text) ? `<p>${escapeHtml(str(r.value.text))}</p>` : '')

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}
function set<T>(v: T) {
  emit('event', 'change', v)
}
function toggle(o: string) {
  picked.value = picked.value.includes(o) ? picked.value.filter((x) => x !== o) : [...picked.value, o]
  set([...picked.value])
}
function pick(o: string) {
  picked.value = [o]
  set(o)
}
const variant = computed(() => str(r.value.variant))
const inputType = computed(
  () => ({ email: 'email', number: 'number', password: 'password' })[variant.value] ?? 'text',
)
const segments = computed(() => opts.value.map((o) => ({ value: o, label: o })))
</script>

<template>
  <div class="pk min-w-0">
    <template v-if="t === 'input'">
      <KitInputSearch
        v-if="variant === 'search'"
        v-model="text"
        :placeholder="str(r.placeholder, label || 'Search…')"
        :disabled="disabled"
        :clearable="on('clearable')"
        :size="size"
        @search="set(text)"
        @update:model-value="set($event)"
      />
      <KitInput
        v-else
        v-model="text"
        :type="inputType"
        :label="label || undefined"
        :placeholder="str(r.placeholder)"
        :disabled="disabled"
        :required="on('required')"
        :clearable="on('clearable')"
        :tooltip="str(r.tooltip) || undefined"
        :helper-text="help"
        :size="size"
        @change="set(text)"
      />
    </template>

    <KitTextarea
      v-else-if="t === 'textarea'"
      v-model="text"
      :label="label || undefined"
      :placeholder="str(r.placeholder)"
      :disabled="disabled"
      :required="on('required')"
      :max-length="num('maxLength', 500)"
      :helper-text="help"
      resize="vertical"
      @blur="set(text)"
    />

    <KitSelectWrapper
      v-else-if="t === 'select'"
      v-model="selected"
      :label="label || undefined"
      :placeholder="str(r.placeholder, 'Select…')"
      :disabled="disabled"
      :multiple="on('multiple')"
      :clearable="on('clearable')"
      :required="on('required')"
      :helper-text="help"
      :size="size"
      @update:model-value="set($event)"
    >
      <KitSelectItem v-for="o in opts" :key="o" :value="o">{{ o }}</KitSelectItem>
    </KitSelectWrapper>

    <fieldset v-else-if="t === 'checkbox' || t === 'radio'" class="m-0 min-w-0 border-0 p-0">
      <legend v-if="label" class="mb-2 p-0 text-[12.5px] font-semibold text-(--app-fg-2)">{{ label }}</legend>
      <div class="flex flex-wrap gap-x-4 gap-y-2">
        <label v-for="o in opts" :key="o" class="inline-flex cursor-pointer items-center gap-2 text-[13px]">
          <KitCheckbox
            v-if="t === 'checkbox'"
            :model-value="picked.includes(o)"
            :disabled="disabled"
            @update:model-value="toggle(o)"
          />
          <input
            v-else
            type="radio"
            :name="block.id"
            class="size-4 accent-(--app-accent)"
            :disabled="disabled"
            :checked="picked.includes(o)"
            @change="pick(o)"
          />{{ o }}
        </label>
      </div>
    </fieldset>

    <label v-else-if="t === 'switch'" class="flex cursor-pointer items-center gap-3">
      <KitSwitch v-model="checked" :disabled="disabled" @update:model-value="set($event)" />
      <span class="min-w-0">
        <span class="block text-[13px] font-semibold">{{ label || 'Switch' }}</span>
        <span v-if="r.text" class="block text-[12px] text-(--app-muted)">{{ str(r.text) }}</span>
      </span>
    </label>

    <template v-else-if="t === 'date'">
      <KitDateRangePicker
        v-if="variant === 'range'"
        v-model="date"
        :label="label || undefined"
        :placeholder="str(r.placeholder, 'Pick dates')"
        :disabled="disabled"
        :helper-text="help"
        :locale="locale"
        @update:model-value="set($event)"
      />
      <KitDatePicker
        v-else
        v-model="date"
        :label="label || undefined"
        :placeholder="str(r.placeholder, 'Pick a date')"
        :disabled="disabled"
        :required="on('required')"
        :time="on('time')"
        :helper-text="help"
        :locale="locale"
        @update:model-value="set($event)"
      />
    </template>

    <template v-else-if="t === 'upload'">
      <KitImageUpload
        v-if="variant === 'image'"
        v-model="image"
        :label="label || 'Photo'"
        :accept="str(r.accept, 'image/*')"
        :max-size="num('maxSizeMb', 5) * 1024 * 1024"
        :disabled="disabled"
        :helper-text="help"
        @update:model-value="set($event)"
      />
      <KitInputFileUpload
        v-else-if="variant === 'field'"
        v-model="files"
        :label="label || undefined"
        :placeholder="str(r.placeholder, 'Choose files')"
        :accept="str(r.accept) || undefined"
        :multiple="on('multiple', true)"
        :max-size="num('maxSizeMb', 10) * 1024 * 1024"
        :disabled="disabled"
        :helper-text="help"
        @update:model-value="set($event)"
      />
      <KitFileUpload
        v-else
        v-model="files"
        :label="label || 'Files'"
        :placeholder="str(r.placeholder, 'Choose files')"
        :accept="str(r.accept) || undefined"
        :multiple="on('multiple', true)"
        :max-size="num('maxSizeMb', 10) * 1024 * 1024"
        :disabled="disabled"
        :helper-text="help"
        @update:model-value="set($event)"
      />
    </template>

    <div v-else-if="t === 'segmented'" class="min-w-0">
      <div v-if="label" class="mb-1.5 text-[12.5px] font-semibold text-(--app-fg-2)">{{ label }}</div>
      <KitMultiselectButton
        v-model="picked"
        :options="segments"
        :multiple="on('multiple')"
        :outlined="on('outlined', true)"
        :variant="kitVariant(r.variant)"
        :size="str(r.size, 'medium')"
        @update:model-value="set($event)"
      />
    </div>

    <div v-else-if="t === 'richtext'" class="min-w-0">
      <div v-if="label" class="mb-1.5 text-[12.5px] font-semibold text-(--app-fg-2)">
        {{ label }}<span v-if="on('required')" class="text-(--app-danger-fg)"> *</span>
      </div>
      <KitRichTextEditor
        v-model="html"
        :readonly="r.mode === 'read'"
        :disabled="disabled"
        :placeholder="str(r.placeholder)"
        :min-height="num('minHeight', 140)"
        :aria-label="label || 'Rich text'"
        :required="on('required')"
        @update:model-value="set($event)"
      />
    </div>
  </div>
</template>
