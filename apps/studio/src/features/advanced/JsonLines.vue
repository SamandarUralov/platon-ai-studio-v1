<script setup lang="ts">
/**
 * Read-only JSON with line numbers. Hovering a key explains it in plain language;
 * clicking a key copies its JSON pointer.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { jsonLines, MAX_LINES } from './jsonLines'
import { keyDoc } from './definitionTree'

const props = defineProps<{ value: unknown; base: string }>()
const emit = defineEmits<{ copyPointer: [pointer: string] }>()
const { t } = useI18n()

const out = computed(() => jsonLines(props.value, props.base))
const host = ref<HTMLElement>()
const tip = ref<{ key: string; doc?: string; pointer: string; top: number; left: number } | null>(null)

function onOver(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')
  if (!el || !host.value) {
    tip.value = null
    return
  }
  const r = el.getBoundingClientRect()
  const h = host.value.getBoundingClientRect()
  const key = el.dataset.key!
  tip.value = {
    key,
    doc: keyDoc(key),
    pointer: el.dataset.pointer!,
    top: r.bottom - h.top + host.value.scrollTop + 4,
    left: Math.min(r.left - h.left + host.value.scrollLeft, h.width - 340),
  }
}

const VALUE_CLASS = {
  string: 'text-ok-dot',
  number: 'text-warn-dot',
  literal: 'text-ai-bg dark:text-ai',
  punct: 'text-code-muted',
} as const
</script>

<template>
  <div
    ref="host"
    class="relative overflow-auto rounded-xl bg-code-bg py-4 font-mono text-[12.5px] leading-[1.7] text-code-fg scroll-thin"
    @mouseover="onOver"
    @mouseleave="tip = null"
  >
    <div v-for="l in out.lines" :key="l.n" class="flex whitespace-pre pr-4 hover:bg-code-bg-2">
      <span class="w-12 shrink-0 select-none pr-4 text-right text-code-muted/70">{{ l.n }}</span>
      <span>{{ '  '.repeat(l.depth) }}</span>
      <template v-if="l.key !== undefined">
        <button
          type="button"
          :data-key="l.key"
          :data-pointer="l.pointer"
          class="cursor-pointer rounded-sm text-primary-ring decoration-dotted underline-offset-2 hover:bg-code-sel hover:underline dark:text-primary-strong"
          @click="emit('copyPointer', l.pointer)"
        >
          "{{ l.key }}"</button
        ><span class="text-code-muted">: </span>
      </template>
      <span :class="VALUE_CLASS[l.kind]">{{ l.text }}</span
      ><span v-if="l.comma" class="text-code-muted">,</span>
    </div>
    <div v-if="out.truncated" class="px-16 pt-2 font-sans text-sm text-code-muted">
      {{ t('advanced.truncated', { n: MAX_LINES }) }}
    </div>
    <div
      v-if="tip"
      class="pointer-events-none absolute z-10 w-[320px] rounded-lg border border-line bg-surface px-3 py-2 font-sans text-sm leading-snug text-fg shadow-pop"
      :style="{ top: `${tip.top}px`, left: `${Math.max(8, tip.left)}px` }"
    >
      <div class="font-mono text-xs font-bold text-primary-strong">{{ tip.key }}</div>
      <div v-if="tip.doc" class="mt-0.5 text-fg-2">{{ tip.doc }}</div>
      <div class="mt-1 truncate font-mono text-2xs text-faint">
        {{ tip.pointer }} · {{ t('advanced.clickToCopy') }}
      </div>
    </div>
  </div>
</template>
