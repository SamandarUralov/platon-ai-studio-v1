<script setup lang="ts">
/** Page tree dropdown in the canvas toolbar (menu order, restricted pages, New page). */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronsUpDown, Lock, Plus } from 'lucide-vue-next'
import { PIcon, PPopover } from '@platon/ui'
import { pageTree, type Page, type PageNode } from '@platon/definition'

const props = defineProps<{ pages: Page[]; current: Page }>()
const emit = defineEmits<{ go: [id: string]; create: [] }>()
const { t } = useI18n()
const open = ref(false)

const flat = computed(() => {
  const out: { node: PageNode; depth: number }[] = []
  const walk = (ns: PageNode[], d: number) =>
    ns.forEach((n) => (out.push({ node: n, depth: d }), walk(n.children, d + 1)))
  walk(pageTree(props.pages), 0)
  return out
})
const index = computed(() => flat.value.findIndex((x) => x.node.id === props.current.id) + 1)

function sub(p: Page, depth: number) {
  if (depth > 0) return p.route
  const roles = p.visibleTo?.length
  return roles
    ? t('interface.pages.subRoles', { blocks: p.blocks.length, roles })
    : t('interface.pages.sub', { blocks: p.blocks.length })
}
function go(id: string) {
  open.value = false
  emit('go', id)
}
</script>

<template>
  <PPopover v-model:open="open" :width="300" class="p-1.5">
    <template #trigger>
      <button
        type="button"
        class="flex h-9 max-w-72 min-w-0 items-center gap-2 rounded-[10px] border border-line bg-surface pr-2 pl-1.5 text-left hover:bg-hover"
        :aria-label="t('interface.pages.switch')"
      >
        <span class="grid size-6 shrink-0 place-items-center rounded-md bg-primary-tint text-primary-strong"
          ><PIcon :name="current.icon" :size="14"
        /></span>
        <span class="min-w-0 truncate text-md font-bold">{{ current.name }}</span>
        <span class="shrink-0 text-xs text-faint">{{
          t('interface.pages.of', { i: index, n: pages.length })
        }}</span>
        <ChevronsUpDown :size="14" class="shrink-0 text-faint" />
      </button>
    </template>
    <div class="flex h-8 items-center px-2.5">
      <span class="eyebrow">{{ t('interface.pages.title') }}</span>
      <span class="ml-auto text-xs text-faint">{{ t('interface.pages.menuOrder') }}</span>
    </div>
    <div class="max-h-[60vh] overflow-y-auto scroll-thin">
      <button
        v-for="{ node, depth } in flat"
        :key="node.id"
        type="button"
        class="relative flex w-full items-center gap-2.5 rounded-lg py-1.5 pr-2 text-left"
        :class="node.id === current.id ? 'bg-primary-tint text-primary-strong' : 'hover:bg-hover'"
        :style="{ paddingLeft: `${10 + depth * 20}px` }"
        @click="go(node.id)"
      >
        <span
          v-if="depth"
          class="absolute top-0 bottom-0 border-l border-line"
          :style="{ left: `${depth * 20 - 2}px` }"
        />
        <PIcon :name="node.page.icon" :size="15" :class="node.id === current.id ? '' : 'text-muted'" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-base font-semibold">{{ node.page.name }}</span>
          <span
            class="block truncate text-xs"
            :class="node.id === current.id ? 'opacity-75' : 'text-faint'"
            >{{ sub(node.page, depth) }}</span
          >
        </span>
        <span
          v-if="node.children.length"
          class="rounded-full bg-subtle px-1.5 text-2xs font-bold text-muted"
          >{{ node.children.length }}</span
        >
        <Lock
          v-if="node.page.visibleTo?.length"
          :size="13"
          class="text-faint"
          :aria-label="t('interface.pages.restricted')"
        />
        <Check v-if="node.id === current.id" :size="15" />
      </button>
    </div>
    <div class="mt-1 border-t border-line-faint pt-1">
      <button
        type="button"
        class="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-base font-semibold text-primary-strong hover:bg-hover"
        @click="((open = false), emit('create'))"
      >
        <Plus :size="15" />{{ t('interface.pages.new') }}
      </button>
    </div>
  </PPopover>
</template>
