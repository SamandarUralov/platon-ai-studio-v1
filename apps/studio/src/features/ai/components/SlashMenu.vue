<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AtSign, Slash } from 'lucide-vue-next'
import { PIcon, cn } from '@platon/ui'
import type { PickGroup, PickItem } from '../types'

/** Popup above the composer for `/` (skills, context, templates) and `@` (context). Keyboard handled by the composer. */
const props = defineProps<{ id: string; trigger: '/' | '@'; groups: PickGroup[]; active: number }>()
defineEmits<{ pick: [item: PickItem]; hover: [index: number] }>()
const { t } = useI18n()
const el = ref<HTMLElement>()

const rows = computed(() => {
  let n = 0
  return props.groups.map((g) => ({ label: g.label, items: g.items.map((it) => ({ it, i: n++ })) }))
})

watch(
  () => props.active,
  async () => {
    await nextTick()
    el.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  },
)

const iconTone = (k: PickItem['kind']) =>
  k === 'skill'
    ? 'bg-primary-tint text-primary-strong'
    : k === 'ctx'
      ? 'bg-teal-bg text-teal'
      : 'bg-subtle text-fg-2'
</script>

<template>
  <div
    ref="el"
    class="absolute right-3 bottom-[calc(100%-6px)] left-3 z-20 max-h-[360px] overflow-auto rounded-xl border border-line bg-surface p-1.5 shadow-pop scroll-thin"
  >
    <div class="flex items-center gap-1.5 px-2.5 pt-1.5 pb-0.5 text-xs font-bold text-fg">
      <component :is="trigger === '@' ? AtSign : Slash" :size="12" class="text-primary" />
      {{ trigger === '@' ? t('ai.contextTitle') : t('ai.skillsTitle') }}
    </div>
    <div :id="id" role="listbox" :aria-label="trigger === '@' ? t('ai.contextTitle') : t('ai.skillsTitle')">
      <div v-for="g in rows" :key="g.label" role="group" :aria-label="g.label">
        <div class="eyebrow px-2.5 pt-2.5 pb-1">{{ g.label }}</div>
        <div
          v-for="{ it, i } in g.items"
          :id="`${id}-${i}`"
          :key="it.key"
          role="option"
          :aria-selected="i === active"
          :data-active="i === active"
          :class="
            cn(
              'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5',
              i === active && 'bg-primary-tint/60',
            )
          "
          @mousedown.prevent="$emit('pick', it)"
          @mouseenter="$emit('hover', i)"
        >
          <div :class="cn('grid size-7 shrink-0 place-items-center rounded-[7px]', iconTone(it.kind))">
            <PIcon :name="it.icon" :size="14" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-base font-semibold text-fg">{{ it.label }}</div>
            <div class="truncate text-xs text-faint">{{ it.desc }}</div>
          </div>
          <span v-if="it.cmd" class="shrink-0 font-mono text-2xs text-faint">{{ it.cmd }}</span>
        </div>
      </div>
    </div>
    <div v-if="!groups.length" class="px-2.5 py-3.5 text-sm text-faint">{{ t('ai.noMatches') }}</div>
    <div class="mt-1 border-t border-line-faint px-2.5 pt-2 pb-1 text-2xs text-faint">
      {{ t('ai.menuHelp') }}
    </div>
  </div>
</template>
