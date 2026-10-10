<script setup lang="ts">
/**
 * The generated app's chrome: side navigation when the frame is at least 768px wide (or the app
 * uses a top bar), menu built from the page tree for the viewer's role, and the app theme as CSS
 * variables scoped to the frame.
 */
import { computed } from 'vue'
import { ChevronDown, ChevronRight, LogOut, Search, Languages } from 'lucide-vue-next'
import { PIcon } from '@platon/ui'
import { pageAncestors, pageTree, type AppDefinition, type PageNode } from '@platon/definition'
import { appThemeVars } from './theme'
import { canOpenPage } from './visibility'
import { translate } from './context'

const props = withDefaults(
  defineProps<{
    definition: AppDefinition
    pageId?: string | null
    /** Viewer role id; undefined shows every page (design mode). */
    role?: string
    width: number
    lang?: string
    user?: { name: string; role: string }
    prefersDark?: boolean
    /** Counter shown next to a menu item, by page id. */
    badges?: Record<string, number>
    /** Fill the parent height instead of growing with content. */
    fill?: boolean
  }>(),
  { pageId: null, fill: false },
)
const emit = defineEmits<{ navigate: [pageId: string]; lang: [code: string] }>()

const vars = computed(() => appThemeVars(props.definition.settings.theme, props.prefersDark))
const side = computed(() => props.width >= 768 && props.definition.interface.navigation.type !== 'topbar')
const appName = computed(() => props.definition.name.split(/\s+/)[0] ?? props.definition.name)
const initial = computed(() => appName.value.slice(0, 1).toUpperCase())
const userInitials = computed(() =>
  (props.user?.name ?? '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)
const name = (id: string, fallback: string) => translate(props.definition, props.lang, `page.${id}`, fallback)

/** In-menu pages the role can open; children of hidden parents move up a level. */
const tree = computed(() => {
  const pages = props.definition.interface.pages.filter(
    (p) => p.inMenu !== false && canOpenPage(p, props.role),
  )
  return pageTree(pages)
})
const activePath = computed(() => {
  if (!props.pageId) return new Set<string>()
  return new Set([
    props.pageId,
    ...pageAncestors(props.definition.interface.pages, props.pageId).map((p) => p.id),
  ])
})
const flat = computed(() => {
  const out: { node: PageNode; depth: number }[] = []
  const walk = (ns: PageNode[], depth: number) => {
    for (const n of ns) {
      out.push({ node: n, depth })
      if (n.children.length && activePath.value.has(n.id)) walk(n.children, depth + 1)
    }
  }
  walk(tree.value, 0)
  return out
})
const langs = computed(() => props.definition.settings.languages)
</script>

<template>
  <div
    class="flex overflow-hidden bg-(--app-bg) text-[13px] text-(--app-fg) [font-family:inherit]"
    :class="[side ? 'flex-row' : 'flex-col', fill ? 'h-full' : 'min-h-[640px]']"
    :style="vars"
  >
    <!-- side navigation -->
    <aside v-if="side" class="flex w-[232px] shrink-0 flex-col border-r border-(--app-line) bg-(--app-side)">
      <div class="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span
          class="grid size-7 place-items-center rounded-lg bg-(--app-accent) text-[13px] font-bold text-(--app-accent-fg)"
          >{{ initial }}</span
        >
        <span class="truncate text-[14px] font-bold">{{ appName }}</span>
      </div>
      <div class="px-3">
        <div
          class="flex h-8 items-center gap-2 rounded-(--app-radius) border border-(--app-line) bg-(--app-surface) px-2.5 text-(--app-faint)"
        >
          <Search :size="13" /><span class="text-[12.5px]">Search</span>
        </div>
      </div>
      <div class="px-4 pt-4 pb-1.5 text-[10.5px] font-bold tracking-wider text-(--app-faint) uppercase">
        Menu
      </div>
      <nav class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <button
          v-for="{ node, depth } in flat"
          :key="node.id"
          type="button"
          class="mb-0.5 flex h-8 w-full items-center gap-2.5 rounded-(--app-radius) pr-2 text-left text-[13px]"
          :class="
            node.id === pageId
              ? 'bg-(--app-accent-tint) font-semibold text-(--app-accent)'
              : 'text-(--app-fg-2) hover:bg-(--app-hover)'
          "
          :style="{ paddingLeft: `${10 + depth * 16}px` }"
          @click.stop="emit('navigate', node.id)"
        >
          <PIcon :name="node.page.icon" :size="15" />
          <span class="min-w-0 flex-1 truncate">{{ name(node.id, node.page.name) }}</span>
          <span
            v-if="badges?.[node.id]"
            class="rounded-md px-1.5 text-[11px] font-bold"
            :class="
              node.id === pageId
                ? 'bg-(--app-accent) text-(--app-accent-fg)'
                : 'bg-(--app-subtle) text-(--app-muted)'
            "
            >{{ badges[node.id] }}</span
          >
          <component
            :is="activePath.has(node.id) ? ChevronDown : ChevronRight"
            v-if="node.children.length"
            :size="14"
            class="text-(--app-faint)"
          />
        </button>
      </nav>
      <div v-if="langs.length > 1" class="flex gap-1 px-3 pb-2">
        <Languages :size="14" class="mt-1.5 text-(--app-faint)" />
        <button
          v-for="l in langs"
          :key="l"
          type="button"
          class="h-7 rounded-md px-2 text-[12px] font-semibold uppercase"
          :class="
            (lang ?? definition.settings.defaultLanguage) === l
              ? 'bg-(--app-subtle) text-(--app-fg)'
              : 'text-(--app-faint)'
          "
          @click.stop="emit('lang', l)"
        >
          {{ l }}
        </button>
      </div>
      <div
        v-if="user"
        class="m-3 mt-1 flex items-center gap-2.5 rounded-(--app-radius-lg) border border-(--app-line) bg-(--app-surface) p-2.5"
      >
        <span
          class="grid size-7 place-items-center rounded-full bg-(--app-accent-tint) text-[11px] font-bold text-(--app-accent)"
          >{{ userInitials }}</span
        >
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[12.5px] font-semibold">{{ user.name }}</span>
          <span class="block truncate text-[11px] text-(--app-faint)">{{ user.role }}</span>
        </span>
        <LogOut :size="14" class="text-(--app-faint)" />
      </div>
    </aside>

    <!-- top navigation -->
    <header
      v-else
      class="flex shrink-0 items-center gap-3 border-b border-(--app-line) bg-(--app-side) px-4 py-2.5"
    >
      <span
        class="grid size-7 shrink-0 place-items-center rounded-lg bg-(--app-accent) text-[13px] font-bold text-(--app-accent-fg)"
        >{{ initial }}</span
      >
      <nav class="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
        <button
          v-for="{ node } in flat.filter((x) => x.depth === 0)"
          :key="node.id"
          type="button"
          class="h-8 shrink-0 rounded-(--app-radius) px-2.5 text-[12.5px] font-semibold whitespace-nowrap"
          :class="
            activePath.has(node.id) ? 'bg-(--app-accent-tint) text-(--app-accent)' : 'text-(--app-muted)'
          "
          @click.stop="emit('navigate', node.id)"
        >
          {{ name(node.id, node.page.name) }}
        </button>
      </nav>
      <span
        v-if="user"
        class="grid size-7 shrink-0 place-items-center rounded-full bg-(--app-accent-tint) text-[11px] font-bold text-(--app-accent)"
        >{{ userInitials }}</span
      >
    </header>

    <main class="min-w-0 flex-1 overflow-y-auto" :class="width < 768 ? 'p-4' : 'px-8 py-7'">
      <slot />
    </main>
  </div>
</template>
