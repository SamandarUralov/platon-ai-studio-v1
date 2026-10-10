<script setup lang="ts">
/** Multi-select as pill chips (columns, numbers, roles). Order follows `options`. */
defineProps<{ options: { value: string; label: string }[] }>()
const model = defineModel<string[]>({ required: true })
function toggle(v: string, all: { value: string }[]) {
  const on = model.value.includes(v)
  model.value = on
    ? model.value.filter((x) => x !== v)
    : all.map((o) => o.value).filter((x) => x === v || model.value.includes(x))
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      :aria-pressed="model.includes(o.value)"
      class="h-7 rounded-full border px-2.5 text-sm font-semibold"
      :class="
        model.includes(o.value)
          ? 'border-primary-ring bg-primary-tint text-primary-strong'
          : 'border-line text-muted hover:bg-hover'
      "
      @click="toggle(o.value, options)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
