<script setup lang="ts">
/**
 * Design mode left panel: this page's blocks, then the elements to add in three groups — built-in
 * UI Kit blocks, this project's custom components, and community components from other teams.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ChevronRight, Plus, Search, Sparkles } from 'lucide-vue-next'
import { PButton, PIcon, PInput, PSelect, PSpinner, toast, type SelectOption } from '@platon/ui'
import {
  BLOCKS,
  type BlockType,
  type CommunityComponent,
  type CustomComponent,
  type Page,
} from '@platon/definition'
import PanelHeader from '@/components/shell/PanelHeader.vue'
import SectionLabel from '@/components/common/SectionLabel.vue'
import { useDefinitionStore } from '@/stores/definition'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useInterfaceStore, type PaletteTab } from '../store'
import { layerTree, paletteGroups, rowLabelOf } from '../lib/blocks'
import PaletteTile from './PaletteTile.vue'
import CustomComponentTile from './CustomComponentTile.vue'
import CommunityComponentTile from './CommunityComponentTile.vue'
import { useCommunityComponents, useCommunityInstall } from '../composables/useCommunity'
import HideLeftPanel from '@/components/shell/HideLeftPanel.vue'

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
const community = useCommunityComponents(q)
const { install, installing, copyOf } = useCommunityInstall()
const communityItems = computed(() => community.data.value ?? [])

const kitCount = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))
const counts = computed<Record<PaletteTab, number>>(() => ({
  kit: kitCount.value,
  custom: comps.value.length,
  community: communityItems.value.length,
}))
const groupOptions = computed<SelectOption<PaletteTab>[]>(() =>
  (['kit', 'custom', 'community'] as const).map((value) => ({
    value,
    label: t(`interface.left.${value === 'kit' ? 'uiKit' : value}`),
    description: t('interface.left.count', { n: counts.value[value] }),
  })),
)
const shownCount = computed(() => counts.value[ui.paletteTab])

async function addCommunity(c: CommunityComponent) {
  try {
    const copy = await install(c)
    if (copy) emit('add', 'custom', copy)
  } catch {
    toast(t('interface.left.installFailed', { name: c.name }), { tone: 'danger' })
  }
}

const layers = computed(() =>
  layerTree(props.page.blocks).map(({ block: b, depth, cell }) => ({
    b,
    depth,
    cell,
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
  <PanelHeader :title="t('interface.left.title')"><HideLeftPanel /></PanelHeader>
  <div class="min-h-0 flex-1 overflow-y-auto pb-3 scroll-thin">
    <button
      type="button"
      class="flex h-8 w-full items-center gap-1.5 px-3.5 text-left"
      :aria-expanded="ui.layersOpen"
      @click="ui.layersOpen = !ui.layersOpen"
    >
      <ChevronRight
        :size="13"
        class="text-faint transition-transform"
        :class="ui.layersOpen ? 'rotate-90' : ''"
      />
      <span class="eyebrow">{{ t('interface.left.pageComponents') }}</span>
      <span class="text-2xs font-bold text-faint-2">{{ layers.length }}</span>
      <span
        class="ml-auto max-w-28 truncate rounded-md bg-subtle px-1.5 py-0.5 text-xs font-semibold text-muted"
        >{{ page.name }}</span
      >
    </button>
    <div v-show="ui.layersOpen" class="px-2">
      <button
        v-for="l in layers"
        :key="l.b.id"
        type="button"
        class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-base"
        :class="
          ui.selected === l.b.id
            ? 'bg-primary-tint text-primary-strong'
            : ui.hovered === l.b.id
              ? 'bg-hover text-fg'
              : 'text-fg hover:bg-hover'
        "
        :style="l.depth ? { paddingLeft: `${10 + l.depth * 14}px` } : undefined"
        :title="l.cell"
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
    <div class="flex gap-2 px-3.5 pb-1">
      <PInput
        v-model="q"
        :icon="Search"
        size="sm"
        class="min-w-0 flex-1"
        :placeholder="t('interface.left.search')"
        :aria-label="t('interface.left.search')"
      />
      <PSelect
        v-model="ui.paletteTab"
        :options="groupOptions"
        size="sm"
        class="w-[112px] shrink-0"
        :aria-label="t('interface.left.group')"
      />
    </div>

    <template v-if="ui.paletteTab === 'kit'">
      <template v-for="g in groups" :key="g.id">
        <SectionLabel :label="t(`interface.group.${g.id}`)" />
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
    </template>

    <template v-else-if="ui.paletteTab === 'custom'">
      <SectionLabel :label="t('interface.left.customHint')">
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
        <p v-if="!comps.length && !q" class="text-sm text-faint">{{ t('interface.left.noCustom') }}</p>
      </div>
    </template>

    <template v-else>
      <SectionLabel :label="t('interface.left.communityHint')" />
      <div class="flex flex-col gap-1.5 px-3.5 pb-2">
        <CommunityComponentTile
          v-for="c in communityItems"
          :key="c.id"
          :component="c"
          :installing="installing === c.id"
          :installed="!!copyOf(c)"
          @add="addCommunity(c)"
        />
        <div v-if="community.isPending.value" class="flex justify-center py-3"><PSpinner :size="16" /></div>
        <p v-else-if="community.isError.value" class="text-sm text-faint">
          {{ t('interface.left.communityError') }}
        </p>
        <p v-else-if="!communityItems.length && !q" class="text-sm text-faint">
          {{ t('interface.left.noCommunity') }}
        </p>
      </div>
    </template>

    <p v-if="q && !shownCount" class="px-3.5 py-2 text-sm text-faint">
      {{ t('interface.left.noMatch', { q }) }}
    </p>
  </div>
</template>
