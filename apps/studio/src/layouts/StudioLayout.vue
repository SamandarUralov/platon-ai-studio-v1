<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TriangleAlert } from 'lucide-vue-next'
import { PButton, PEmptyState, PSpinner } from '@platon/ui'
import { useDefinitionStore } from '@/stores/definition'
import { useUiStore } from '@/stores/ui'
import { useShortcuts } from '@/composables/useShortcuts'
import TopBar from '@/components/shell/TopBar.vue'
import CommandPalette from '@/components/shell/CommandPalette.vue'
import ShortcutsDialog from '@/components/shell/ShortcutsDialog.vue'
import ConsoleDock from '@/features/console/ConsoleDock.vue'

const route = useRoute()
const router = useRouter()
const def = useDefinitionStore()
const ui = useUiStore()
const projectId = computed(() => String(route.params.projectId))

watch(projectId, (id) => void def.load(id), { immediate: true })

// Remember where people go, for ⌘K "Recent".
watch(
  () => route.fullPath,
  () => {
    if (route.meta.layer)
      ui.visit({
        path: route.fullPath,
        label: String(route.meta.title ?? route.meta.layer),
        icon: 'map-pin',
        layer: String(route.meta.layer),
      })
  },
  { immediate: true },
)

const pinKeys = Array.from({ length: 9 }, (_, i) => ({
  keys: `alt+${i + 1}`,
  run: () => {
    const p = ui.pins[i]
    if (!p) return false
    void router.push(p.path)
  },
}))

useShortcuts([
  { keys: 'mod+k', run: () => void (ui.paletteOpen = !ui.paletteOpen), inInputs: true },
  { keys: 'mod+/', run: () => void (ui.shortcutsOpen = true), inInputs: true },
  { keys: 'mod+,', run: () => void (ui.leftOpen = !ui.leftOpen), inInputs: true },
  { keys: 'mod+.', run: () => void (ui.rightOpen = !ui.rightOpen), inInputs: true },
  { keys: 'mod+\\', run: () => ui.toggleFocus(), inInputs: true },
  { keys: 'ctrl+`', run: () => void (ui.consoleOpen = !ui.consoleOpen), inInputs: true },
  { keys: 'mod+z', run: () => (def.canUndo ? def.undo() : false) },
  { keys: 'mod+shift+z', run: () => (def.canRedo ? def.redo() : false) },
  ...pinKeys,
])
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-bg">
    <TopBar :project-id="projectId" />
    <div v-if="def.loading && !def.ready" class="grid flex-1 place-items-center text-muted">
      <PSpinner :size="22" />
    </div>
    <div v-else-if="def.loadError" class="grid flex-1 place-items-center">
      <PEmptyState :icon="TriangleAlert" title="Couldn’t open this app" :description="def.loadError">
        <PButton variant="ink" @click="def.load(projectId, true)">Try again</PButton>
        <PButton @click="router.push({ name: 'home' })">All apps</PButton>
      </PEmptyState>
    </div>
    <template v-else-if="def.ready">
      <div class="min-h-0 flex-1">
        <RouterView v-slot="{ Component }">
          <component :is="Component" />
        </RouterView>
      </div>
      <ConsoleDock v-if="ui.consoleOpen" />
    </template>
    <CommandPalette />
    <ShortcutsDialog />
  </div>
</template>
