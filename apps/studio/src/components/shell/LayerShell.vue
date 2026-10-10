<script setup lang="ts">
/**
 * Three-column layer layout (requirements §3.1): left navigator, centre workspace, right
 * inspector / Studio AI. Both side panels collapse to an icon rail, resize by dragging,
 * and auto-collapse on narrow windows without overwriting the saved preference.
 */
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { PanelLeftOpen, PanelRightOpen, PanelLeftClose } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { kbd } from '@/composables/useShortcuts'

const props = withDefaults(
  defineProps<{ hasLeft?: boolean; hasRight?: boolean; leftMin?: number; rightMin?: number }>(),
  {
    hasLeft: true,
    hasRight: true,
    leftMin: 220,
    rightMin: 300,
  },
)
const ui = useUiStore()
const narrow = useMediaQuery('(max-width: 1180px)')
const veryNarrow = useMediaQuery('(max-width: 980px)')

const leftShown = computed(() => props.hasLeft && ui.leftOpen && !veryNarrow.value)
const rightShown = computed(() => props.hasRight && ui.rightOpen && !narrow.value)

function startResize(side: 'left' | 'right', e: PointerEvent) {
  const startX = e.clientX
  const start = side === 'left' ? ui.leftWidth : ui.rightWidth
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - startX
    if (side === 'left') ui.leftWidth = Math.min(480, Math.max(props.leftMin, start + dx))
    else ui.rightWidth = Math.min(560, Math.max(props.rightMin, start - dx))
  }
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
}
</script>

<template>
  <div class="flex h-full min-h-0">
    <!-- left -->
    <template v-if="hasLeft">
      <aside
        v-if="leftShown"
        class="relative flex shrink-0 flex-col border-r border-line-2 bg-surface"
        :style="{ width: `${ui.leftWidth}px` }"
      >
        <slot name="left" />
        <button
          type="button"
          class="absolute bottom-2 right-2 grid size-7 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg"
          :title="`Hide panel (${kbd('mod+,')})`"
          aria-label="Hide left panel"
          @click="ui.leftOpen = false"
        >
          <PanelLeftClose :size="15" />
        </button>
        <div
          class="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize"
          role="separator"
          aria-orientation="vertical"
          @pointerdown="startResize('left', $event)"
        />
      </aside>
      <aside
        v-else
        class="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-line-2 bg-surface py-2"
      >
        <button
          type="button"
          class="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"
          :title="`Show panel (${kbd('mod+,')})`"
          aria-label="Show left panel"
          @click="ui.leftOpen = true"
        >
          <PanelLeftOpen :size="16" />
        </button>
        <slot name="left-rail" />
      </aside>
    </template>

    <!-- centre -->
    <main class="relative flex min-w-0 flex-1 flex-col bg-bg">
      <slot />
    </main>

    <!-- right -->
    <template v-if="hasRight">
      <aside
        v-if="rightShown"
        class="relative flex shrink-0 flex-col border-l border-line-2 bg-surface"
        :style="{ width: `${ui.rightWidth}px` }"
      >
        <div
          class="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize"
          role="separator"
          aria-orientation="vertical"
          @pointerdown="startResize('right', $event)"
        />
        <slot name="right" :close="() => (ui.rightOpen = false)" />
      </aside>
      <aside
        v-else
        class="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-line-2 bg-surface py-2"
      >
        <button
          type="button"
          class="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"
          :title="`Show panel (${kbd('mod+.')})`"
          aria-label="Show right panel"
          @click="ui.rightOpen = true"
        >
          <PanelRightOpen :size="16" />
        </button>
        <slot name="right-rail" />
      </aside>
    </template>
  </div>
</template>
