<script setup lang="ts">
/** Design mode left panel: this page's blocks, element palette and custom components. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Plus, Search, Sparkles } from 'lucide-vue-next'
import { PButton, PIcon, PInput } from '@platon/ui'
import { BLOCKS, type BlockType, type CustomComponent, type Page } from '@platon/definition'
import PanelHeader from '@/components/shell/PanelHeader.vue'
import SectionLabel from '@/components/common/SectionLabel.vue'
import { useDefinitionStore } from '@/stores/definition'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useInterfaceStore } from '../store'
import { paletteGroups, rowLabelOf } from '../lib/blocks'
import PaletteTile from './PaletteTile.vue'
import CustomComponentTile from './CustomComponentTile.vue'

const props = defineProps<{ page: Page }>()
const emit = defineEmits<{ add: [type: BlockType, component?: CustomComponent] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const ui = useInterfaceStore()
const router = useRouter()
const pid = useProjectId()

const q = ref('')
const groups = computed(() => paletteGroups(q.value))
const comps = computed(() => {
  const s = q.value.trim().toLowerCase()
  return (def.definition?.components ?? []).filter(
    (c) => c.folder !== 'pages' && (!s || c.name.toLowerCase().includes(s)),
  )
})
const layers = computed(() =>
  props.page.blocks.map((b) => ({
    b,
    label: b.title || BLOCKS[b.type].label,
    row: rowLabelOf(props.page.blocks, b.id),
  })),
)

function select(id: string) {
  ui.select(id)
  document
    .querySelector(`[data-canvas-block="${id}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
</script>

<template>
  <PanelHeader :title="t('interface.left.title')" />
  <div class="min-h-0 flex-1 overflow-y-auto pb-12 scroll-thin">
    <SectionLabel :label="t('interface.left.pageComponents')">
      <span class="max-w-28 truncate rounded-md bg-subtle px-1.5 py-0.5 text-xs font-semibold text-muted">{{
        page.name
      }}</span>
    </SectionLabel>
    <div class="px-2">
      <button
        v-for="l in layers"
        :key="l.b.id"
        type="button"
        class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-base"
        :class="ui.selected === l.b.id ? 'bg-primary-tint text-primary-strong' : 'text-fg hover:bg-hover'"
        @click="select(l.b.id)"
      >
        <PIcon :name="BLOCKS[l.b.type].icon" :size="15" :class="ui.selected === l.b.id ? '' : 'text-muted'" />
        <span class="min-w-0 flex-1 truncate">{{ l.label }}</span>
        <span class="font-mono text-2xs" :class="ui.selected === l.b.id ? '' : 'text-faint'">{{
          t('interface.row', { n: l.row })
        }}</span>
      </button>
      <p v-if="!layers.length" class="px-2.5 py-2 text-sm text-faint">{{ t('interface.left.emptyPage') }}</p>
    </div>

    <div class="mx-3.5 my-3 border-t border-line-faint" />
    <div class="px-3.5 pb-2">
      <PInput
        v-model="q"
        :icon="Search"
        size="sm"
        :placeholder="t('interface.left.search')"
        :aria-label="t('interface.left.search')"
      />
    </div>
    <p v-if="q && !groups.length && !comps.length" class="px-3.5 py-2 text-sm text-faint">
      {{ t('interface.left.noMatch', { q }) }}
    </p>

    <template v-if="comps.length || !q">
      <SectionLabel :label="t('interface.left.custom')">
        <PButton size="xs" variant="tint" :icon="Plus" @click="router.push(projectLinks(pid).components())">{{
          t('interface.left.new')
        }}</PButton>
        <PButton
          size="xs"
          variant="ai"
          square
          :icon="Sparkles"
          :label="t('interface.left.askAi')"
          @click="ui.rightTab = 'ai'"
        />
      </SectionLabel>
      <div class="flex flex-col gap-1.5 px-3.5 pb-2">
        <CustomComponentTile
          v-for="c in comps"
          :key="c.id"
          :component="c"
          @add="emit('add', 'custom', c)"
          @edit="router.push(projectLinks(pid).components(c.id))"
        />
        <p v-if="!comps.length" class="text-sm text-faint">{{ t('interface.left.noCustom') }}</p>
      </div>
    </template>

    <template v-for="g in groups" :key="g.id">
      <SectionLabel
        :label="
          g.kit
            ? `${t(`interface.group.${g.id}`)} · ${t('interface.left.uiKit')}`
            : t(`interface.group.${g.id}`)
        "
      />
      <div class="grid grid-cols-2 gap-2 px-3.5 pb-2">
        <PaletteTile
          v-for="it in g.items"
          :key="it.type"
          :type="it.type"
          :meta="it.meta"
          @add="emit('add', it.type)"
        />
      </div>
    </template>
  </div>
</template>
