<script setup lang="ts">
/**
 * Advanced · App definition (requirements §3.8): a read-only, live JSON view of the same definition
 * the visual editors and Studio AI change. Tree on the left, selected node on the right.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Check, ChevronRight, Code, Copy, Info, Link2, PencilRuler, Search, SearchX } from 'lucide-vue-next'
import { PButton, PEmptyState, PIcon, PInput, PTree, toast } from '@platon/ui'
import { getAt } from '@platon/definition'
import LayerShell from '@/components/shell/LayerShell.vue'
import PanelHeader from '@/components/shell/PanelHeader.vue'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'
import { buildDefinitionTree, filterTree, trail, type DefNode } from './definitionTree'
import { linkForPointer } from '@/composables/definitionLinks'
import JsonLines from './JsonLines.vue'

const { t } = useI18n()
const def = useDefinitionStore()
const route = useRoute()
const router = useRouter()
const projectId = useProjectId()

const query = ref('')
const tree = computed(() => (def.definition ? buildDefinitionTree(def.definition) : []))
const shown = computed(() => filterTree(tree.value, query.value))
const treeRef = ref<{ toggle: (id: string) => void; isOpen: (id: string) => boolean } | null>(null)

const DEFAULT = computed(() => {
  const first = def.definition?.interface.pages[0]
  return first ? `/interface/pages/${first.id}` : '/interface'
})
const selected = computed(() => {
  const q = route.query.node
  return typeof q === 'string' && q.startsWith('/') ? q : DEFAULT.value
})
const crumbs = computed(() => trail(tree.value, selected.value))
const node = computed(() => crumbs.value.at(-1) ?? null)
const value = computed(() => (def.definition ? getAt(def.definition, selected.value) : undefined))
const target = computed(() =>
  node.value && !node.value.section ? linkForPointer(projectId.value, selected.value, def.definition) : null,
)

function select(n: DefNode | string) {
  const id = typeof n === 'string' ? n : n.id
  void router.replace({ query: { ...route.query, node: id } })
}

/** Open every ancestor so the selection is visible (tree starts collapsed below sections). */
function reveal(id: string) {
  const t = treeRef.value
  if (!t) return
  for (const a of trail(tree.value, id).slice(0, -1)) if (!t.isOpen(a.id)) t.toggle(a.id)
}

onMounted(() => {
  const t = treeRef.value
  if (!t) return
  for (const s of tree.value) if (!t.isOpen(s.id)) t.toggle(s.id)
  reveal(selected.value)
})
watch(selected, (id) => void nextTick(() => reveal(id)))

const copied = ref<'json' | 'pointer' | null>(null)
async function copy(kind: 'json' | 'pointer', text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = kind
    setTimeout(() => (copied.value = null), 1200)
  } catch {
    toast(t('advanced.copyFailed'), { tone: 'danger' })
  }
}
function copyPointer(p: string) {
  void copy('pointer', p)
  toast(t('advanced.pointerCopied', { p }))
}

const total = (s: DefNode) => s.children?.reduce((a, c) => a + (c.children?.length || 1), 0) ?? 0
</script>

<template>
  <LayerShell :has-right="false">
    <template #left>
      <PanelHeader :title="t('advanced.title')" :sub="t('advanced.sub')" />
      <div class="border-b border-line-faint p-2.5">
        <PInput
          v-model="query"
          :icon="Search"
          size="sm"
          :placeholder="t('advanced.search')"
          :aria-label="t('advanced.search')"
        />
      </div>
      <div class="min-h-0 flex-1 overflow-auto px-2 py-2 scroll-thin">
        <PTree
          v-if="shown.length"
          ref="treeRef"
          :key="query ? `q:${query}` : 'all'"
          :items="shown"
          :selected-id="selected"
          :default-expanded="!!query"
          :indent="12"
          @select="select"
        >
          <template #row="{ item, selected: sel }">
            <PIcon :name="item.icon" :size="14" class="shrink-0" :class="sel ? '' : 'text-muted'" />
            <span
              class="min-w-0 flex-1 truncate"
              :class="item.section ? 'font-bold' : 'font-medium'"
              :title="item.label"
              >{{ item.label }}</span
            >
            <span
              v-if="item.tag"
              class="shrink-0 rounded bg-subtle px-1 font-mono text-2xs font-semibold text-muted"
              >{{ item.tag }}</span
            >
            <span v-else-if="item.section" class="shrink-0 text-2xs font-bold text-faint-2">{{
              total(item)
            }}</span>
          </template>
        </PTree>
        <PEmptyState
          v-else
          :icon="SearchX"
          :title="t('advanced.noMatch')"
          :description="t('advanced.noMatchHint')"
        />
      </div>
    </template>

    <div class="min-h-0 flex-1 overflow-auto px-7 pb-12 pt-6 scroll-thin">
      <div class="mx-auto max-w-[1100px]">
        <!-- breadcrumb -->
        <nav class="flex flex-wrap items-center gap-1 text-sm text-muted" :aria-label="t('advanced.path')">
          <template v-for="(c, i) in crumbs" :key="c.id">
            <ChevronRight v-if="i > 0" :size="12" class="text-faint-2" />
            <button
              type="button"
              class="rounded px-1 hover:bg-hover hover:text-fg"
              :class="i === crumbs.length - 1 && 'font-semibold text-fg'"
              @click="select(c)"
            >
              {{ c.label }}
            </button>
          </template>
        </nav>

        <div class="mt-1.5 flex flex-wrap items-start gap-3">
          <div class="min-w-0 flex-1">
            <h1 class="m-0 truncate text-[22px] font-extrabold tracking-tight">
              {{ node?.label ?? selected }}
            </h1>
            <button
              type="button"
              class="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 font-mono text-xs text-faint hover:bg-hover hover:text-fg"
              :title="t('advanced.copyPointer')"
              @click="copyPointer(selected)"
            >
              <component :is="copied === 'pointer' ? Check : Link2" :size="12" />
              <span class="truncate">{{ selected }}</span>
            </button>
          </div>
          <div class="flex shrink-0 gap-2">
            <PButton
              :icon="copied === 'json' ? Check : Copy"
              :disabled="value === undefined"
              @click="copy('json', JSON.stringify(value, null, 2))"
            >
              {{ copied === 'json' ? t('advanced.copied') : t('advanced.copyJson') }}
            </PButton>
            <PButton v-if="target" variant="ink" :icon="PencilRuler" @click="router.push(target.to)">{{
              t('advanced.openVisual', { layer: target.layer })
            }}</PButton>
          </div>
        </div>

        <div
          class="mt-4 flex items-start gap-2.5 rounded-[10px] border border-warn/30 bg-warn-bg px-3.5 py-2.5 text-sm leading-relaxed text-warn"
        >
          <Info :size="14" class="mt-0.5 shrink-0" />
          <span>{{ t('advanced.banner') }}</span>
        </div>

        <div class="mt-4">
          <JsonLines v-if="value !== undefined" :value="value" :base="selected" @copy-pointer="copyPointer" />
          <PEmptyState
            v-else
            :icon="Code"
            :title="t('advanced.missing')"
            :description="t('advanced.missingHint')"
          >
            <PButton @click="select(DEFAULT)">{{ t('advanced.backToPages') }}</PButton>
          </PEmptyState>
        </div>
      </div>
    </div>
  </LayerShell>
</template>
