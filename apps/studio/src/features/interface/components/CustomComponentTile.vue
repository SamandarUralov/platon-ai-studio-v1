<script setup lang="ts">
/** A custom component in the palette: collapsible preview, draggable onto the page. */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, GripVertical, Move, Pencil, Puzzle } from 'lucide-vue-next'
import { PBadge } from '@platon/ui'
import type { CustomComponent } from '@platon/definition'
import CustomComponentPreview from '@/features/components/CustomComponentPreview.vue'
import { useDraggable } from '../composables/dnd'

const props = defineProps<{ component: CustomComponent }>()
const emit = defineEmits<{ add: []; edit: [] }>()
const { t } = useI18n()
const open = ref(false)
const el = ref<HTMLElement>()
useDraggable(el, () => ({ kind: 'new', type: 'custom', component: props.component.id }))
</script>

<template>
  <div ref="el" class="rounded-xl border border-line bg-surface" @dblclick="emit('add')">
    <div class="flex h-10 items-center gap-1.5 pr-1 pl-1.5">
      <GripVertical :size="14" class="shrink-0 cursor-grab text-faint-2" />
      <span class="grid size-6 shrink-0 place-items-center rounded-md bg-primary-tint text-primary-strong"
        ><Puzzle :size="13"
      /></span>
      <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ component.name }}</span>
      <PBadge size="xs" :tone="component.source.type === 'ai' ? 'ai' : 'ok'">{{
        component.source.type === 'ai' ? 'AI' : 'Vue'
      }}</PBadge>
      <button
        type="button"
        class="grid size-6 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"
        :aria-label="t('interface.left.editComponent')"
        @click="emit('edit')"
      >
        <Pencil :size="13" />
      </button>
      <button
        type="button"
        class="grid size-6 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"
        :aria-label="t('interface.left.togglePreview')"
        :aria-expanded="open"
        @click="open = !open"
      >
        <ChevronDown :size="14" class="transition-transform" :class="open ? 'rotate-180' : ''" />
      </button>
    </div>
    <div v-if="open" class="mx-1.5 mb-1.5 rounded-lg bg-subtle p-2">
      <div class="pointer-events-none max-h-40 overflow-hidden">
        <CustomComponentPreview :component="component" :zoom="0.6" />
      </div>
      <div class="mt-1.5 flex items-center gap-1 text-xs text-faint">
        <Move :size="12" />{{ t('interface.left.dragHint') }}
      </div>
    </div>
  </div>
</template>
