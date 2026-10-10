<script setup lang="ts">
/** "Sandbox files" navigator: src/components and src/pages with an AI / Vue chip per file. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileCode2, FolderOpen, TriangleAlert } from 'lucide-vue-next'
import { PSpinner, PTree } from '@platon/ui'
import type { CustomComponent, SandboxFile } from '@platon/definition'

const props = defineProps<{
  files: SandboxFile[] | undefined
  components: CustomComponent[]
  selectedId?: string | null
  loading?: boolean
}>()
const emit = defineEmits<{ select: [componentId: string] }>()
const { t } = useI18n()

interface Node {
  id: string
  kind: 'folder' | 'file' | 'empty'
  label: string
  componentId?: string
  origin?: 'ai' | 'code'
  missing?: boolean
  children?: Node[]
}

const FOLDERS = [
  ['components', 'src/components', 'components.noComponents'],
  ['pages', 'src/pages', 'components.noPages'],
] as const

const tree = computed<Node[]>(() =>
  FOLDERS.map(([folder, path, empty]) => {
    const files = (props.files ?? []).filter((f) => f.path.startsWith(`${path}/`))
    const children: Node[] = files.map((f) => ({
      id: f.path,
      kind: 'file',
      label: f.path.slice(path.length + 1),
      componentId: f.componentId,
      origin: props.components.find((c) => c.id === f.componentId)?.source.type ?? f.origin,
    }))
    // Components listed in the definition whose file isn't in the sandbox (yet).
    if (props.files)
      for (const c of props.components)
        if ((c.folder ?? 'components') === folder && !files.some((f) => f.path === c.file))
          children.push({
            id: c.file,
            kind: 'file',
            label: `${c.name}.vue`,
            componentId: c.id,
            origin: c.source.type,
            missing: true,
          })
    if (!children.length) children.push({ id: `empty:${folder}`, kind: 'empty', label: t(empty) })
    return { id: path, kind: 'folder', label: path, children }
  }),
)

const selectedNode = computed(
  () =>
    tree.value
      .flatMap((f) => f.children ?? [])
      .find((n) => n.componentId && n.componentId === props.selectedId)?.id ?? null,
)

function onSelect(n: Node) {
  if (n.kind === 'file' && n.componentId) emit('select', n.componentId)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-auto px-2.5 pb-4 pt-3 scroll-thin">
    <div class="eyebrow mb-1.5 px-1">{{ t('components.sandboxFiles') }}</div>
    <div v-if="loading && !files" class="grid place-items-center py-8 text-muted">
      <PSpinner :size="16" />
    </div>
    <PTree v-else :items="tree" :selected-id="selectedNode" :indent="12" @select="onSelect">
      <template #row="{ item, selected }">
        <template v-if="item.kind === 'folder'">
          <FolderOpen :size="14" class="shrink-0 text-faint" />
          <span class="truncate font-mono text-sm text-muted">{{ item.label }}</span>
        </template>
        <span v-else-if="item.kind === 'empty'" class="truncate text-sm text-faint">{{ item.label }}</span>
        <template v-else>
          <FileCode2 :size="14" class="shrink-0" :class="selected ? 'text-primary-strong' : 'text-muted'" />
          <span class="min-w-0 flex-1 truncate font-mono text-sm">{{ item.label }}</span>
          <TriangleAlert
            v-if="item.missing"
            :size="13"
            class="shrink-0 text-warn"
            :aria-label="t('components.fileMissing', { file: item.id })"
          />
          <span
            class="flex h-[18px] shrink-0 items-center rounded-[5px] px-1.5 font-mono text-[10px] font-extrabold"
            :class="item.origin === 'ai' ? 'bg-purple-bg text-purple' : 'bg-teal-bg text-teal'"
          >
            {{ item.origin === 'ai' ? t('components.chip.ai') : t('components.chip.vue') }}
          </span>
        </template>
      </template>
    </PTree>
  </div>
</template>
