<script setup lang="ts" generic="T extends { id: string; children?: T[] }">
/**
 * Minimal accessible tree. Row content comes from the `row` slot; the tree owns expand state,
 * selection highlight and keyboard navigation (↑ ↓ ← →).
 */
import { computed, ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{ items: T[]; selectedId?: string | null; indent?: number; defaultExpanded?: boolean }>(),
  {
    indent: 14,
    defaultExpanded: true,
  },
)
const emit = defineEmits<{ select: [item: T] }>()
const collapsed = ref(new Set<string>())
const expandedExtra = ref(new Set<string>())

function isOpen(id: string) {
  return props.defaultExpanded ? !collapsed.value.has(id) : expandedExtra.value.has(id)
}
function toggle(id: string) {
  const set = props.defaultExpanded ? collapsed.value : expandedExtra.value
  if (set.has(id)) set.delete(id)
  else set.add(id)
}

interface FlatRow {
  item: T
  depth: number
  hasChildren: boolean
  parentId: string | null
}
const flat = computed(() => {
  const out: FlatRow[] = []
  const walk = (list: T[], depth: number, parentId: string | null) => {
    for (const it of list) {
      const hasChildren = !!it.children?.length
      out.push({ item: it, depth, hasChildren, parentId })
      if (hasChildren && isOpen(it.id)) walk(it.children!, depth + 1, it.id)
    }
  }
  walk(props.items, 0, null)
  return out
})

function onKey(e: KeyboardEvent) {
  const i = flat.value.findIndex((r) => r.item.id === props.selectedId)
  const row = flat.value[i]
  if (e.key === 'ArrowDown' && flat.value[i + 1]) emit('select', flat.value[i + 1]!.item)
  else if (e.key === 'ArrowUp' && i > 0) emit('select', flat.value[i - 1]!.item)
  else if (e.key === 'ArrowRight' && row?.hasChildren && !isOpen(row.item.id)) toggle(row.item.id)
  else if (e.key === 'ArrowLeft' && row) {
    if (row.hasChildren && isOpen(row.item.id)) toggle(row.item.id)
    else if (row.parentId) {
      const parent = flat.value.find((r) => r.item.id === row.parentId)
      if (parent) emit('select', parent.item)
    }
  } else return
  e.preventDefault()
}

defineExpose({ toggle, isOpen })
</script>

<template>
  <div role="tree" tabindex="0" class="outline-none" @keydown="onKey">
    <div
      v-for="r in flat"
      :key="r.item.id"
      role="treeitem"
      :aria-selected="r.item.id === selectedId"
      :aria-expanded="r.hasChildren ? isOpen(r.item.id) : undefined"
      class="group flex h-8 cursor-pointer items-center gap-1 rounded-lg pr-1.5 text-base"
      :class="r.item.id === selectedId ? 'bg-primary-tint text-primary-strong' : 'text-fg hover:bg-hover'"
      :style="{ paddingLeft: `${4 + r.depth * indent}px` }"
      @click="emit('select', r.item)"
    >
      <button
        v-if="r.hasChildren"
        type="button"
        class="grid size-5 shrink-0 place-items-center rounded text-faint hover:text-fg"
        :aria-label="isOpen(r.item.id) ? 'Collapse' : 'Expand'"
        @click.stop="toggle(r.item.id)"
      >
        <ChevronRight :size="13" class="transition-transform" :class="isOpen(r.item.id) && 'rotate-90'" />
      </button>
      <span v-else class="w-5 shrink-0" />
      <slot name="row" :item="r.item" :depth="r.depth" :selected="r.item.id === selectedId" />
    </div>
  </div>
</template>
