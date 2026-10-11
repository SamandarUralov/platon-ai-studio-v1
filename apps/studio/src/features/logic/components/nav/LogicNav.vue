<script setup lang="ts">
/** Logic navigator: one search across all groups, foldable groups with packages, status and dirty marks. */
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, X } from 'lucide-vue-next'
import { LOGIC_KINDS, type Api, type LogicKind, type LogicStatsResponse } from '@platon/definition'
import { cn, PIcon, PStatusDot, toneClasses, type Tone } from '@platon/ui'
import { problemsUnder } from '@platon/validators'
import { useDefinitionStore } from '@/stores/definition'
import { useDraftsStore } from '@/stores/drafts'
import { apiLabel } from '../../lib/apis'
import { itemTitle } from '../../lib/items'
import { PKG_KIND, type LogicItem, type NavEntry } from '../../lib/nav'
import { itemStatus } from '../../lib/status'
import NavGroup from './NavGroup.vue'
import HideLeftPanel from '@/components/shell/HideLeftPanel.vue'

const props = defineProps<{
  kind: LogicKind
  activeId: string | null
  stats: LogicStatsResponse | undefined
  fill?: boolean
}>()
const emit = defineEmits<{ open: [kind: LogicKind, id: string]; create: [kind: LogicKind, pkg?: string] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const drafts = useDraftsStore()

const KINDS = Object.keys(LOGIC_KINDS) as LogicKind[]

function entryOf(kind: LogicKind, saved: LogicItem): NavEntry {
  const it = drafts.value<LogicItem>(`/logic/${kind}/${saved.id}`) ?? saved
  if (kind === 'apis') {
    const l = apiLabel(it as Api)
    return { kind, id: it.id, label: l.text, badge: l.badge, package: saved.package }
  }
  return { kind, id: it.id, label: itemTitle(kind, it), package: saved.package }
}

const groups = computed(() => {
  const d = def.definition
  if (!d) return []
  return KINDS.map((kind) => {
    const items = d.logic[kind] as LogicItem[]
    const statuses = new Map<string, Tone>()
    const dirty = new Set<string>()
    for (const it of items) {
      const path = `/logic/${kind}/${it.id}`
      statuses.set(it.id, itemStatus(kind, it, problemsUnder(def.problems, path), props.stats).tone)
      if (drafts.isDirty(path)) dirty.add(it.id)
    }
    return {
      kind,
      entries: items.map((it) => entryOf(kind, it)),
      packages: (d.logic.packages ?? []).filter((p) => p.kind === PKG_KIND[kind]),
      statuses,
      dirty,
    }
  })
})

function badgeTone(e: NavEntry): Tone {
  const a = def.definition?.logic.apis.find((x) => x.id === e.id)
  return a ? apiLabel(a).tone : 'neutral'
}

// ── search ──
const searching = ref(false)
const q = ref('')
const searchEl = ref<HTMLInputElement>()
async function openSearch() {
  searching.value = true
  await nextTick()
  searchEl.value?.focus()
}
function closeSearch() {
  q.value = ''
  searching.value = false
}
const results = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return []
  return groups.value
    .map((g) => ({
      ...g,
      entries: g.entries.filter((e) => `${e.badge ?? ''} ${e.label} ${e.id}`.toLowerCase().includes(s)),
    }))
    .filter((g) => g.entries.length)
})
function pick(kind: LogicKind, id: string) {
  emit('open', kind, id)
  closeSearch()
}
function onSearchKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeSearch()
  if (e.key === 'Enter') {
    const first = results.value[0]?.entries[0]
    if (first) pick(first.kind, first.id)
  }
}
defineExpose({ openSearch })
</script>

<template>
  <div class="flex min-h-0 shrink-0 flex-col" :class="fill || (searching && q) ? 'flex-1' : 'max-h-[58%]'">
    <div class="flex h-12 shrink-0 items-center gap-2 border-b border-line-faint px-3.5">
      <template v-if="!searching">
        <div class="min-w-0 flex-1 truncate text-md font-bold">{{ t('logic.title') }}</div>
        <button
          type="button"
          class="grid size-7 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"
          :title="t('logic.nav.search')"
          @click="openSearch"
        >
          <Search :size="15" />
        </button>
      </template>
      <div
        v-else
        class="flex h-8 flex-1 items-center gap-2 rounded-lg border border-primary bg-surface px-2 shadow-focus"
      >
        <Search :size="14" class="text-faint" />
        <input
          ref="searchEl"
          v-model="q"
          class="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          :placeholder="t('logic.nav.search')"
          @keydown="onSearchKey"
        />
        <button
          type="button"
          class="text-faint hover:text-fg"
          :aria-label="t('logic.close')"
          @click="closeSearch"
        >
          <X :size="14" />
        </button>
      </div>
      <HideLeftPanel />
    </div>

    <div class="min-h-0 flex-1 overflow-auto px-2 py-2 scroll-thin">
      <template v-if="searching && q.trim()">
        <div v-for="g in results" :key="g.kind" class="mb-2">
          <div class="flex items-center gap-1.5 px-2 pb-1 pt-1 text-xs font-bold text-muted">
            <PIcon :name="LOGIC_KINDS[g.kind].icon" :size="12" />{{ t(`logic.kinds.${g.kind}`)
            }}<span class="text-faint">{{ g.entries.length }}</span>
          </div>
          <button
            v-for="e in g.entries"
            :key="e.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hover"
            @click="pick(g.kind, e.id)"
          >
            <PStatusDot :tone="g.statuses.get(e.id) ?? 'ok'" />
            <span
              v-if="e.badge"
              :class="
                cn(
                  'shrink-0 rounded px-1 font-mono text-2xs font-bold',
                  toneClasses[badgeTone(e)].bg,
                  toneClasses[badgeTone(e)].fg,
                )
              "
              >{{ e.badge }}</span
            >
            <span class="min-w-0 flex-1 truncate font-mono text-sm">{{ e.label }}</span>
          </button>
        </div>
        <p v-if="!results.length" class="px-3 py-4 text-center text-sm text-faint">
          {{ t('logic.nothingMatches', { q }) }}
        </p>
      </template>
      <template v-else>
        <NavGroup
          v-for="g in groups"
          :key="g.kind"
          :kind="g.kind"
          :entries="g.entries"
          :packages="g.packages"
          :active-id="g.kind === kind ? activeId : null"
          :statuses="g.statuses"
          :dirty="g.dirty"
          :badge-tone="badgeTone"
          @open="emit('open', g.kind, $event)"
          @create="emit('create', g.kind, $event)"
        />
      </template>
    </div>
  </div>
</template>
