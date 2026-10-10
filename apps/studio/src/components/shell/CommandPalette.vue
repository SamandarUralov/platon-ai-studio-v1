<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Fuse from 'fuse.js'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'reka-ui'
import { Search, Pin } from 'lucide-vue-next'
import { PIcon, PKbd } from '@platon/ui'
import { useUiStore } from '@/stores/ui'
import { useSearchIndex, type SearchEntry } from '@/composables/useSearchIndex'
import { kbd } from '@/composables/useShortcuts'

const ui = useUiStore()
const router = useRouter()
const { t } = useI18n()
const index = useSearchIndex()
const q = ref('')
const active = ref(0)
const input = ref<HTMLInputElement>()

const fuse = computed(() => new Fuse(index.value, { keys: ['label', 'sub'], threshold: 0.38 }))

interface Section {
  title: string
  items: (SearchEntry & { pinned?: boolean })[]
}
const sections = computed<Section[]>(() => {
  if (q.value.trim())
    return [
      { title: t('palette.everything'), items: fuse.value.search(q.value, { limit: 30 }).map((r) => r.item) },
    ]
  const byPath = new Map(index.value.map((e) => [router.resolve(e.to).fullPath, e]))
  const fromPins = ui.pins.map((p) => byPath.get(p.path)).filter((x): x is SearchEntry => !!x)
  const fromRecent = ui.recent
    .map((p) => byPath.get(p.path))
    .filter((x): x is SearchEntry => !!x && !fromPins.includes(x))
  return [
    { title: t('palette.pinned'), items: fromPins.map((x) => ({ ...x, pinned: true })) },
    { title: t('palette.recent'), items: fromRecent.slice(0, 6) },
    { title: t('palette.everything'), items: index.value.slice(0, 12) },
  ].filter((s) => s.items.length)
})
const flat = computed(() => sections.value.flatMap((s) => s.items))

watch(
  () => ui.paletteOpen,
  async (o) => {
    if (!o) return
    q.value = ''
    active.value = 0
    await nextTick()
    input.value?.focus()
  },
)
watch(q, () => (active.value = 0))

function go(e: SearchEntry) {
  ui.paletteOpen = false
  void router.push(e.to)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') active.value = Math.min(flat.value.length - 1, active.value + 1)
  else if (e.key === 'ArrowUp') active.value = Math.max(0, active.value - 1)
  else if (e.key === 'Enter' && flat.value[active.value]) go(flat.value[active.value]!)
  else return
  e.preventDefault()
}
</script>

<template>
  <DialogRoot v-model:open="ui.paletteOpen">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-overlay" />
      <DialogContent
        class="fixed left-1/2 top-[12vh] z-50 w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-modal outline-none animate-rise"
        @keydown="onKey"
      >
        <DialogTitle class="sr-only">Quick switcher</DialogTitle>
        <DialogDescription class="sr-only"
          >Search pages, logic, tables and settings. Use arrow keys and Enter.</DialogDescription
        >
        <div class="flex items-center gap-2.5 border-b border-line-faint px-4">
          <Search :size="16" class="text-faint" />
          <input
            ref="input"
            v-model="q"
            :placeholder="t('palette.placeholder')"
            class="h-12 flex-1 bg-transparent text-lg outline-none placeholder:text-faint-2"
          />
          <PKbd>Esc</PKbd>
        </div>
        <div class="max-h-[56vh] overflow-auto p-2 scroll-thin">
          <template v-for="s in sections" :key="s.title">
            <div class="eyebrow px-2 pb-1 pt-2">{{ s.title }}</div>
            <button
              v-for="e in s.items"
              :key="s.title + e.id"
              type="button"
              class="flex h-10 w-full items-center gap-3 rounded-[9px] px-2 text-left"
              :class="flat.indexOf(e) === active ? 'bg-primary-tint' : 'hover:bg-hover'"
              @mouseenter="active = flat.indexOf(e)"
              @click="go(e)"
            >
              <span class="grid size-7 place-items-center rounded-lg bg-subtle text-muted"
                ><PIcon :name="e.icon" :size="14"
              /></span>
              <span class="min-w-0 flex-1 truncate text-md font-semibold">{{ e.label }}</span>
              <Pin v-if="e.pinned" :size="12" class="text-warn-dot" />
              <span class="truncate text-xs text-faint">{{ e.sub }}</span>
              <PKbd v-if="e.pinned && ui.pins.findIndex((p) => p.label === e.label) < 9">{{
                kbd(`alt+${ui.pins.findIndex((p) => p.label === e.label) + 1}`)
              }}</PKbd>
            </button>
          </template>
          <div v-if="!flat.length" class="px-2 py-8 text-center text-base text-faint">
            {{ t('palette.empty') }}
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
