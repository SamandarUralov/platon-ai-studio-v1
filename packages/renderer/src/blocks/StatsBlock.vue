<script setup lang="ts">
import { computed } from 'vue'
import { type BlockProps, list, useResolved } from './props'
import { STATS, statsSource } from '../stats'
import { translate } from '../context'
import { applyRecordCondition } from '../visibility'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)

const items = computed(() => {
  const def = props.ctx.definition
  const src = statsSource(def)
  const rows = applyRecordCondition(def, props.block, (src && props.ctx.records[src]) || [])
  const loaded = !!(src && props.ctx.records[src])
  const today = props.ctx.today ?? new Date().toISOString().slice(0, 10)
  return list(r.value.items)
    .filter((k) => STATS[k])
    .map((k) => ({
      key: k,
      label: translate(def, props.ctx.lang, `stat.${k}`, STATS[k]!.label),
      value: loaded ? STATS[k]!.count(rows, { def, today, viewer: props.ctx.viewer?.name }) : '—',
      accent: STATS[k]!.accent,
    }))
})
</script>

<template>
  <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
    <button
      v-for="it in items"
      :key="it.key"
      type="button"
      class="rounded-(--app-radius-lg) border border-(--app-line) bg-(--app-surface) p-4 text-left hover:border-(--app-accent-soft)"
      @click.stop="emit('event', 'click', { key: it.key, value: it.value })"
    >
      <div class="text-[12px] font-medium text-(--app-muted)">{{ it.label }}</div>
      <div
        class="mt-1.5 text-[1.6em] leading-none font-bold"
        :class="it.accent ? 'text-(--app-danger-fg)' : ''"
      >
        {{ it.value }}
      </div>
    </button>
    <div
      v-if="!items.length"
      class="rounded-(--app-radius-lg) border border-dashed border-(--app-line) p-4 text-[12.5px] text-(--app-faint)"
    >
      Pick numbers to show
    </div>
  </div>
</template>
