<script setup lang="ts">
/** Canvas toolbar: page switcher, route/breadcrumb, viewport, Design/Code (⌘E) and focus mode. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Code, Maximize2, Minimize2, PenTool } from 'lucide-vue-next'
import { PButton, PSegmented } from '@platon/ui'
import { pageAncestors, type Page } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { useUiStore } from '@/stores/ui'
import { kbd } from '@/composables/useShortcuts'
import { useInterfaceStore, type Mode } from '../store'
import PageSwitcher from './PageSwitcher.vue'
import ViewportPopover from './ViewportPopover.vue'

const props = defineProps<{ page: Page; dirty?: boolean }>()
const emit = defineEmits<{ go: [id: string]; create: [] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const uiShell = useUiStore()
const ui = useInterfaceStore()
const pages = computed(() => def.definition?.interface.pages ?? [])
const crumbs = computed(() => pageAncestors(pages.value, props.page.id))
const modes = computed(() => [
  {
    value: 'design' as Mode,
    label: t('interface.mode.design'),
    icon: PenTool,
    title: `${t('interface.mode.design')} (${kbd('mod+e')})`,
  },
  {
    value: 'code' as Mode,
    label: t('interface.mode.code'),
    icon: Code,
    title: `${t('interface.mode.code')} (${kbd('mod+e')})`,
    badge: props.dirty ? '•' : undefined,
  },
])
</script>

<template>
  <div class="flex h-14 shrink-0 items-center gap-2 border-b border-line-2 bg-surface px-3">
    <PageSwitcher :pages="pages" :current="page" @go="emit('go', $event)" @create="emit('create')" />
    <div class="flex min-w-0 items-center gap-1.5 font-mono text-sm text-faint">
      <template v-for="c in crumbs" :key="c.id">
        <button type="button" class="truncate font-sans hover:text-fg" @click="emit('go', c.id)">
          {{ c.name }}</button
        ><span>/</span>
      </template>
      <span class="truncate">{{ page.route }}</span>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <ViewportPopover
        v-if="ui.mode === 'design'"
        v-model:width="ui.width"
        v-model:zoom="ui.zoom"
        v-model:hand="ui.hand"
        :effective-zoom="ui.effectiveZoom"
        show-hand
      />
      <PSegmented v-model="ui.mode" :options="modes" size="md" :aria-label="t('interface.mode.label')" />
      <PButton
        square
        :icon="uiShell.focusMode ? Minimize2 : Maximize2"
        :label="`${t('interface.focus')} (${kbd('mod+\\')})`"
        @click="uiShell.toggleFocus()"
      />
    </div>
  </div>
</template>
