<script setup lang="ts">
/** Lightweight read-only JSON with syntax colours and a copy button (no Monaco needed). */
import { computed, ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ value: unknown; maxHeight?: string; copyable?: boolean }>(), {
  copyable: true,
})
const text = computed(() =>
  typeof props.value === 'string' ? props.value : JSON.stringify(props.value, null, 2),
)
const copied = ref(false)

const html = computed(() =>
  text.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (m, str, colon, lit, num) => {
        if (str)
          return colon
            ? `<span class="text-[#9aa3ff]">${str}</span>${colon}`
            : `<span class="text-[#a5d6a7]">${str}</span>`
        if (lit) return `<span class="text-[#c792ea]">${lit}</span>`
        if (num) return `<span class="text-[#f2b45a]">${num}</span>`
        return m
      },
    ),
)

async function copy() {
  await navigator.clipboard.writeText(text.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}
</script>

<template>
  <div class="relative rounded-[10px] bg-code-bg">
    <button
      v-if="copyable"
      type="button"
      class="absolute right-2 top-2 flex h-7 items-center gap-1 rounded-md bg-code-line px-2 text-xs font-semibold text-code-fg hover:bg-code-sel"
      @click="copy"
    >
      <component :is="copied ? Check : Copy" :size="12" />{{ copied ? 'Copied' : 'Copy' }}
    </button>
    <!-- eslint-disable-next-line vue/no-v-html -- input is escaped above -->
    <pre
      class="m-0 overflow-auto p-4 font-mono text-[12.5px] leading-5 text-code-fg scroll-thin"
      :style="{ maxHeight }"
      v-html="html"
    />
  </div>
</template>
