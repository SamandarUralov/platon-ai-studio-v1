<script setup lang="ts">
/** One block on the canvas: selection outline, label, quick actions, drag source and drop target. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, GripVertical, Lock, Trash2 } from 'lucide-vue-next'
import { PIcon } from '@platon/ui'
import { BLOCKS, type Block, type CustomComponent, type DropSide } from '@platon/definition'
import { BlockView, type RenderContext } from '@platon/renderer'
import CustomComponentPreview from '@/features/components/CustomComponentPreview.vue'
import { useDraggable, useDropTarget, type DragData } from '../composables/dnd'

export interface MoveAbility {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

const props = defineProps<{
  block: Block
  ctx: RenderContext
  selected: boolean
  can: MoveAbility
  restricted?: string | null
  component?: CustomComponent | null
  /** Canvas zoom; overlays counter-scale so they stay readable. */
  zoom?: number
  /** First row: overlays sit inside the block so the frame edge doesn't clip them. */
  first?: boolean
}>()
const emit = defineEmits<{
  select: []
  move: [dir: keyof MoveAbility]
  duplicate: []
  remove: []
  drop: [data: DragData, side: DropSide]
}>()
const { t } = useI18n()
const el = ref<HTMLElement>()
const side = ref<DropSide | null>(null)
const dragging = ref(false)

useDraggable(el, () => ({ kind: 'move', id: props.block.id }), {
  onStart: () => (dragging.value = true),
  onEnd: () => (dragging.value = false),
})
useDropTarget(el, {
  over: (s) => (side.value = s),
  drop: (d, s) => emit('drop', d, s),
  canDrop: (d) => !(d.kind === 'move' && d.id === props.block.id),
})

const overlay = computed(() => ({ zoom: 1 / (props.zoom || 1) }))
const LINE: Record<DropSide, string> = {
  before: '-top-[7px] left-0 right-0 h-[3px]',
  after: '-bottom-[7px] left-0 right-0 h-[3px]',
  left: '-left-[7px] top-0 bottom-0 w-[3px]',
  right: '-right-[7px] top-0 bottom-0 w-[3px]',
}
</script>

<template>
  <div
    ref="el"
    :data-canvas-block="block.id"
    class="group/blk relative min-w-[min(100%,220px)] flex-1 cursor-pointer rounded-[12px] outline-offset-4"
    :class="[
      selected ? 'outline-2 outline-primary' : 'hover:outline-1 hover:outline-primary-ring',
      dragging ? 'opacity-40' : '',
    ]"
    role="button"
    tabindex="0"
    :aria-label="`${BLOCKS[block.type].label}: ${block.title ?? block.ref}`"
    :aria-pressed="selected"
    @click.stop="emit('select')"
    @keydown.enter.self="emit('select')"
  >
    <!-- label -->
    <div
      v-if="selected"
      :style="overlay"
      :class="first ? 'top-1 left-1' : '-top-[28px] left-0'"
      class="absolute z-10 flex h-[22px] max-w-[70%] items-center gap-1 rounded-md bg-primary px-1.5 text-xs font-semibold text-on-accent"
    >
      <span class="cursor-grab" :title="t('interface.canvas.drag')"><GripVertical :size="12" /></span>
      <PIcon :name="BLOCKS[block.type].icon" :size="12" />
      <span class="truncate">{{ BLOCKS[block.type].label }}{{ block.title ? ` · ${block.title}` : '' }}</span>
    </div>
    <div
      v-if="restricted"
      :style="overlay"
      :class="[first ? 'top-1 right-1' : '-top-[28px] right-0', selected ? 'hidden' : '']"
      class="absolute z-10 flex h-[22px] items-center gap-1 rounded-md bg-purple-bg px-1.5 text-xs font-semibold text-purple group-hover/blk:hidden"
    >
      <Lock :size="11" />{{ restricted }}
    </div>

    <!-- actions -->
    <div
      v-if="selected"
      :style="overlay"
      :class="first ? 'top-1 right-1' : '-top-[34px] right-0'"
      class="absolute z-10 flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-card"
      @click.stop
    >
      <button
        v-for="d in ['up', 'down', 'left', 'right'] as const"
        :key="d"
        type="button"
        class="grid size-6 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg disabled:opacity-30"
        :disabled="!can[d]"
        :title="t(`interface.canvas.move.${d}`)"
        :aria-label="t(`interface.canvas.move.${d}`)"
        @click="emit('move', d)"
      >
        <component :is="{ up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight }[d]" :size="13" />
      </button>
      <span class="mx-0.5 h-4 w-px bg-line" />
      <button
        type="button"
        class="grid size-6 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"
        :title="t('interface.canvas.duplicate')"
        :aria-label="t('interface.canvas.duplicate')"
        @click="emit('duplicate')"
      >
        <Copy :size="13" />
      </button>
      <button
        type="button"
        class="grid size-6 place-items-center rounded-md text-danger hover:bg-danger-bg"
        :title="t('interface.canvas.delete')"
        :aria-label="t('interface.canvas.delete')"
        @click="emit('remove')"
      >
        <Trash2 :size="13" />
      </button>
    </div>

    <!-- content (inert in design mode) -->
    <div class="pointer-events-none select-none" inert>
      <BlockView :block="block" :ctx="ctx">
        <template #custom>
          <CustomComponentPreview :component="component" :values="block.props as Record<string, unknown>" />
        </template>
      </BlockView>
    </div>

    <!-- drop indicator -->
    <template v-if="side">
      <div class="pointer-events-none absolute z-20 rounded-full bg-primary" :class="LINE[side]" />
      <div
        :style="overlay"
        class="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-on-accent shadow-pop"
      >
        {{ t(`interface.canvas.drop.${side}`) }}
      </div>
    </template>
  </div>
</template>
