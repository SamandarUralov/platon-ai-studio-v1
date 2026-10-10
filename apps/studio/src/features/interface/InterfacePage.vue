<script setup lang="ts">
/**
 * Interface layer (F5/F6): pages built visually on a canvas (Design) or as page code (Code, ⌘E).
 * Route: /p/:projectId/interface/:pageId? — defaults to the first page.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { FileQuestion } from 'lucide-vue-next'
import { PEmptyState, PButton, toast } from '@platon/ui'
import type { BlockType, CustomComponent, Page } from '@platon/definition'
import LayerShell from '@/components/shell/LayerShell.vue'
import { useDefinitionStore } from '@/stores/definition'
import { useShortcuts } from '@/composables/useShortcuts'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useInterfaceStore } from './store'
import { useInterfaceEdits } from './composables/useInterfaceEdits'
import { createBlock } from './lib/blocks'
import { stepZoom } from './lib/viewport'
import { usePageScript } from './code/usePageScript'
import CanvasToolbar from './components/CanvasToolbar.vue'
import DesignLeftPanel from './components/DesignLeftPanel.vue'
import DesignCanvas from './components/DesignCanvas.vue'
import RightPanel from './components/RightPanel.vue'
import NewPageDialog from './components/NewPageDialog.vue'
import CodeMode from './code/CodeMode.vue'
import CodeLeftPanel from './code/CodeLeftPanel.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const def = useDefinitionStore()
const ui = useInterfaceStore()
const edits = useInterfaceEdits()
const pid = useProjectId()

const pages = computed(() => def.definition?.interface.pages ?? [])
// No page in the URL opens the first page. Resolving here instead of redirecting avoids racing a
// navigation the user starts while this layer is still loading.
const pageId = computed(() =>
  route.params.pageId ? String(route.params.pageId) : (pages.value[0]?.id ?? null),
)
const page = computed<Page | undefined>(() => pages.value.find((p) => p.id === pageId.value))

watch(pageId, () => ui.select(null))

const script = usePageScript(() => page.value ?? pages.value[0]!)
const go = (id: string) => void router.push(projectLinks(pid.value).interface(id))

function add(type: BlockType, component?: CustomComponent) {
  const p = page.value
  if (!p || !def.definition) return
  const b = createBlock(type, def.definition, p, component)
  const target = ui.selected && p.blocks.some((x) => x.id === ui.selected) ? ui.selected : null
  if (edits.addBlock(p, b, target, 'after')) {
    ui.select(b.id)
    toast(t('interface.added', { block: b.title ?? b.ref }), { tone: 'ok' })
  }
}

const newPageOpen = ref(false)
function createPage(p: Page) {
  if (edits.addPage(p)) go(p.id)
}

function deleteSelected() {
  const p = page.value
  const b = p?.blocks.find((x) => x.id === ui.selected)
  if (!p || !b || ui.mode !== 'design') return false
  edits.deleteBlock(p, b)
  ui.select(null)
}
function zoomBy(dir: 1 | -1) {
  if (ui.mode !== 'design') return false
  ui.zoom = stepZoom(ui.effectiveZoom, dir)
}

useShortcuts([
  { keys: 'mod+e', run: () => void (ui.mode = ui.mode === 'design' ? 'code' : 'design'), inInputs: true },
  { keys: 'escape', run: () => (ui.selected && ui.mode === 'design' ? ui.select(null) : false) },
  { keys: 'delete', run: deleteSelected },
  { keys: 'backspace', run: deleteSelected },
  {
    keys: 'mod+d',
    run: () => {
      const p = page.value
      const b = p?.blocks.find((x) => x.id === ui.selected)
      if (!p || !b || ui.mode !== 'design') return false
      ui.select(edits.duplicateBlock(p, b).id)
    },
  },
  { keys: 'mod+=', run: () => zoomBy(1) },
  { keys: 'mod+shift+=', run: () => zoomBy(1) },
  { keys: 'mod+-', run: () => zoomBy(-1) },
  { keys: 'mod+0', run: () => (ui.mode === 'design' ? void (ui.zoom = 'fit') : false) },
])
</script>

<template>
  <LayerShell v-if="page">
    <template #left>
      <DesignLeftPanel v-if="ui.mode === 'design'" :page="page" @add="add" />
      <CodeLeftPanel v-else :page="page" />
    </template>
    <CanvasToolbar :page="page" :dirty="script.dirty.value" @go="go" @create="newPageOpen = true" />
    <DesignCanvas v-if="ui.mode === 'design'" :page="page" @go="go" />
    <CodeMode v-else :key="page.id" :page="page" />
    <template #right="{ close }">
      <RightPanel :page="page" :close="close" />
    </template>
  </LayerShell>
  <div v-else-if="pageId" class="grid h-full place-items-center">
    <PEmptyState
      :icon="FileQuestion"
      :title="t('interface.missing.title')"
      :description="t('interface.missing.body')"
    >
      <PButton variant="ink" @click="go(pages[0]!.id)">{{ t('interface.missing.open') }}</PButton>
    </PEmptyState>
  </div>
  <NewPageDialog v-model:open="newPageOpen" :parent="page?.parent" @create="createPage" />
</template>
