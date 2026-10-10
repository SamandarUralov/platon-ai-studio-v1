<script setup lang="ts">
/** Platon UI Kit form controls: input, select, checkbox, radio, switch, date, textarea, upload. */
import { computed, ref } from 'vue'
import { CalendarDays, Paperclip, Upload, X } from 'lucide-vue-next'
import { type BlockProps, FIELD, list, str, tr, useResolved } from './props'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const t = computed(() => props.block.type)
const label = computed(() => tr(props, 'title', r.value.title ?? ''))
const opts = computed(() => {
  const o = list(r.value.options)
  return o.length ? o : ['Low', 'Normal', 'High', 'Urgent']
})
const disabled = computed(() => props.ctx.design || r.value.disabled === true)

const text = ref('')
const picked = ref<string[]>([])
const on = ref(r.value.checked === true)
const files = ref<string[]>(['site-photo-01.jpg'])

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
const inputType = computed(
  () => ({ email: 'email', search: 'search', password: 'password' })[str(r.value.variant)] ?? 'text',
)
</script>

<template>
  <div class="min-w-0">
    <div
      v-if="label && t !== 'switch'"
      class="mb-1.5 flex items-center text-[12.5px] font-semibold text-(--app-fg-2)"
    >
      {{ label }}
      <span v-if="t === 'textarea'" class="ml-auto font-normal text-(--app-faint)"
        >{{ text.length }} / 500</span
      >
    </div>

    <template v-if="t === 'input'">
      <input
        v-model="text"
        :type="inputType"
        :class="FIELD"
        :disabled="disabled"
        :placeholder="str(r.placeholder)"
        @change="set(text)"
      />
      <p v-if="r.help" class="mt-1 mb-0 text-[12px] text-(--app-faint)">{{ str(r.help) }}</p>
    </template>

    <textarea
      v-else-if="t === 'textarea'"
      v-model="text"
      maxlength="500"
      rows="3"
      :class="FIELD"
      class="h-auto py-2"
      :disabled="disabled"
      :placeholder="str(r.placeholder)"
      @change="set(text)"
    />

    <select
      v-else-if="t === 'select'"
      :class="FIELD"
      :disabled="disabled"
      @change="pick(($event.target as HTMLSelectElement).value)"
    >
      <option value="">{{ str(r.placeholder, 'Select…') }}</option>
      <option v-for="o in opts" :key="o">{{ o }}</option>
    </select>

    <div v-else-if="t === 'checkbox' || t === 'radio'" class="flex flex-wrap gap-x-4 gap-y-2">
      <label v-for="o in opts" :key="o" class="inline-flex cursor-pointer items-center gap-2 text-[13px]">
        <input
          :type="t === 'radio' ? 'radio' : 'checkbox'"
          :name="block.id"
          class="size-4 accent-(--app-accent)"
          :disabled="disabled"
          :checked="picked.includes(o)"
          @change="t === 'radio' ? pick(o) : toggle(o)"
        />{{ o }}
      </label>
    </div>

    <label v-else-if="t === 'switch'" class="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        :aria-checked="on"
        :disabled="disabled"
        class="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        :class="on ? 'bg-(--app-accent)' : 'bg-(--app-line)'"
        @click.stop="((on = !on), set(on))"
      >
        <span
          class="absolute top-0.5 size-4 rounded-full bg-white shadow transition-all"
          :class="on ? 'left-[18px]' : 'left-0.5'"
        />
      </button>
      <span class="min-w-0">
        <span class="block text-[13px] font-semibold">{{ label || 'Switch' }}</span>
        <span v-if="r.text" class="block text-[12px] text-(--app-muted)">{{ str(r.text) }}</span>
      </span>
      <span class="ml-auto text-[12px] text-(--app-faint)">{{ on ? 'On' : 'Off' }}</span>
    </label>

    <label v-else-if="t === 'date'" class="relative block">
      <CalendarDays
        :size="14"
        class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--app-faint)"
      />
      <input
        type="date"
        :class="FIELD"
        class="pl-8"
        :disabled="disabled"
        @change="set(($event.target as HTMLInputElement).value)"
      />
    </label>

    <div v-else-if="t === 'upload'">
      <div
        class="flex flex-col items-center gap-1 rounded-(--app-radius-lg) border border-dashed border-(--app-line) bg-(--app-subtle) px-4 py-5 text-center"
      >
        <Upload :size="18" class="text-(--app-accent)" />
        <span class="text-[13px] font-semibold"
          >Drop files here or <span class="text-(--app-accent)">browse</span></span
        >
        <span class="text-[11.5px] text-(--app-faint)">JPG, PNG or PDF · up to 20 MB</span>
      </div>
      <div
        v-for="(f, i) in files"
        :key="f"
        class="mt-2 flex items-center gap-2 rounded-(--app-radius) border border-(--app-line) px-3 py-2 text-[12.5px]"
      >
        <Paperclip :size="13" class="text-(--app-faint)" />{{ f }}
        <button
          type="button"
          class="ml-auto text-(--app-faint) hover:text-(--app-fg)"
          aria-label="Remove file"
          :disabled="disabled"
          @click.stop="files.splice(i, 1)"
        >
          <X :size="13" />
        </button>
      </div>
    </div>
  </div>
</template>
