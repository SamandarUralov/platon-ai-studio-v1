<script setup lang="ts">
/** Collapses the left LayerShell panel; sits at the end of the panel's header row. */
import { PanelLeftClose } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { kbd } from '@/composables/useShortcuts'

const ui = useUiStore()
</script>

<template>
  <button
    type="button"
    class="grid size-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg"
    :title="`Hide panel (${kbd('mod+,')})`"
    aria-label="Hide left panel"
    @click="ui.leftOpen = false"
  >
    <PanelLeftClose :size="15" />
  </button>
</template>
