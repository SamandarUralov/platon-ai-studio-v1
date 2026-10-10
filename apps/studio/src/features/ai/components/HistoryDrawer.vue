<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { Check, MessageSquare, Search } from 'lucide-vue-next'
import { PBadge, PInput, PSpinner, cn } from '@platon/ui'
import type { AiConversationSummary } from '@platon/definition'

const props = defineProps<{
  items: AiConversationSummary[]
  loading?: boolean
  currentId: string | null
  me?: string
}>()
defineEmits<{ open: [id: string] }>()
const { t } = useI18n()
const q = ref('')

function groupOf(iso: string): 'today' | 'yesterday' | 'earlier' {
  const d = dayjs(iso)
  if (d.isSame(dayjs(), 'day')) return 'today'
  if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return 'yesterday'
  return 'earlier'
}

function timeOf(iso: string) {
  const g = groupOf(iso)
  return g === 'earlier' ? dayjs(iso).format('MMM D') : dayjs(iso).format('h:mm A')
}

const groups = computed(() => {
  const s = q.value.trim().toLowerCase()
  const rows = props.items.filter(
    (c) => !s || c.title.toLowerCase().includes(s) || c.snippet.toLowerCase().includes(s),
  )
  return (['today', 'yesterday', 'earlier'] as const)
    .map((g) => ({ id: g, label: t(`ai.${g}`), items: rows.filter((r) => groupOf(r.updatedAt) === g) }))
    .filter((g) => g.items.length)
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-auto bg-bg-home scroll-thin">
    <div class="px-3 pt-3 pb-1">
      <PInput
        v-model="q"
        :placeholder="t('ai.searchChats')"
        :icon="Search"
        size="sm"
        :aria-label="t('ai.searchChats')"
      />
    </div>
    <div v-if="loading" class="grid place-items-center p-6"><PSpinner /></div>
    <div v-for="g in groups" :key="g.id" class="px-2 pt-2 pb-1">
      <div class="eyebrow px-2 py-1.5">{{ g.label }}</div>
      <button
        v-for="c in g.items"
        :key="c.id"
        type="button"
        :class="
          cn(
            'mb-1 block w-full rounded-[10px] border p-2.5 text-left transition-colors hover:bg-hover',
            c.id === currentId ? 'border-primary-ring bg-primary-tint/40' : 'border-line-soft bg-surface',
          )
        "
        @click="$emit('open', c.id)"
      >
        <div class="flex items-center gap-2">
          <div class="min-w-0 flex-1 truncate text-base font-semibold text-fg">{{ c.title }}</div>
          <span class="shrink-0 text-2xs text-faint">{{ timeOf(c.updatedAt) }}</span>
        </div>
        <div class="mt-0.5 line-clamp-2 text-sm leading-snug text-muted">{{ c.snippet }}</div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <PBadge v-if="c.id === currentId" tone="primary" size="xs">{{ t('ai.current') }}</PBadge>
          <PBadge v-if="c.appliedCount" tone="ok" size="xs" :icon="Check">{{
            t('ai.appliedN', { n: c.appliedCount })
          }}</PBadge>
          <PBadge v-if="c.hasPendingPlan" tone="warn" size="xs">{{ t('ai.planWaiting') }}</PBadge>
          <PBadge tone="neutral" size="xs" :icon="MessageSquare">{{ c.messageCount }}</PBadge>
          <PBadge v-if="c.by && c.by !== me" tone="neutral" size="xs">{{ c.by }}</PBadge>
        </div>
      </button>
    </div>
    <div v-if="!loading && !groups.length" class="p-6 text-center text-sm text-faint">
      {{ items.length ? t('ai.noChats') : t('ai.noChatsYet') }}
    </div>
    <div class="mx-3 mt-auto mb-3 rounded-[10px] bg-subtle px-3 py-2.5 text-xs leading-snug text-muted">
      {{ t('ai.sharedNote') }}
    </div>
  </div>
</template>
