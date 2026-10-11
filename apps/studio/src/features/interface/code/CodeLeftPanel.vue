<script setup lang="ts">
/** Code mode left panel: outline of the page file, page blocks and available logic. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Braces, Sigma, Variable, Zap, Workflow } from 'lucide-vue-next'
import { PIcon } from '@platon/ui'
import { BLOCKS, type Page } from '@platon/definition'
import PanelHeader from '@/components/shell/PanelHeader.vue'
import SectionLabel from '@/components/common/SectionLabel.vue'
import { useDefinitionStore } from '@/stores/definition'
import { useInterfaceStore } from '../store'
import { parseOutline, signature, type OutlineKind } from '../lib/script'
import { usePageScript } from './usePageScript'
import HideLeftPanel from '@/components/shell/HideLeftPanel.vue'

const props = defineProps<{ page: Page }>()
const { t } = useI18n()
const def = useDefinitionStore()
const ui = useInterfaceStore()
const script = usePageScript(() => props.page)
const outline = computed(() => parseOutline(script.source.value))
const fns = computed(() => def.definition?.logic.functions ?? [])
const ICON: Record<OutlineKind, typeof Braces> = {
  state: Variable,
  computed: Sigma,
  hook: Workflow,
  handler: Zap,
}
const TONE: Record<OutlineKind, string> = {
  state: 'bg-warn-bg text-warn',
  computed: 'bg-teal-bg text-teal',
  hook: 'bg-purple-bg text-purple',
  handler: 'bg-primary-tint text-primary-strong',
}
</script>

<template>
  <PanelHeader :title="t('interface.code.leftTitle')" :sub="t('interface.code.leftSub')"
    ><HideLeftPanel
  /></PanelHeader>
  <div class="min-h-0 flex-1 overflow-y-auto pb-3 scroll-thin">
    <SectionLabel :label="t('interface.code.outline')" :count="outline.length" />
    <div class="px-2">
      <button
        v-for="o in outline"
        :key="`${o.kind}:${o.label}:${o.line}`"
        type="button"
        class="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-hover"
        :title="t('interface.code.jump', { line: o.line })"
        @click="ui.jumpTo(o.line)"
      >
        <span class="grid size-5 shrink-0 place-items-center rounded-md" :class="TONE[o.kind]"
          ><component :is="ICON[o.kind]" :size="11"
        /></span>
        <span class="min-w-0 flex-1 truncate font-mono text-sm">{{ o.label }}</span>
        <span class="text-2xs text-faint">{{ t(`interface.code.kind.${o.kind}`) }}</span>
      </button>
      <p v-if="!outline.length" class="px-2 py-1 text-sm text-faint">{{ t('interface.code.noOutline') }}</p>
    </div>

    <SectionLabel :label="t('interface.code.blocks')" :count="page.blocks.length" />
    <div class="px-2">
      <button
        v-for="b in page.blocks"
        :key="b.id"
        type="button"
        class="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hover"
        :title="t('interface.code.insertRef', { ref: b.ref })"
        @click="ui.insert(`ctx.blocks.${b.ref}`)"
      >
        <PIcon :name="BLOCKS[b.type].icon" :size="14" class="mt-0.5 text-primary-strong" />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-mono text-sm">{{ b.ref }}</span>
          <span class="block truncate text-xs text-faint"
            >{{ BLOCKS[b.type].label
            }}{{ BLOCKS[b.type].events.length ? ` · ${BLOCKS[b.type].events.join(', ')}` : '' }}</span
          >
        </span>
      </button>
    </div>

    <SectionLabel :label="t('interface.code.logic')" :count="fns.length" />
    <div class="px-2">
      <button
        v-for="f in fns"
        :key="f.id"
        type="button"
        class="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hover"
        :title="t('interface.code.insertCall', { name: f.name })"
        @click="ui.insert(`await ctx.call('${f.name}'${f.params.map((p) => `, ${p.name}`).join('')})`)"
      >
        <Braces :size="14" class="mt-0.5 shrink-0 text-primary-strong" />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-mono text-sm">{{ f.name }}</span>
          <span class="block truncate font-mono text-xs text-faint"
            >{{ signature(f) }} → {{ f.returns.type }}</span
          >
        </span>
      </button>
    </div>
  </div>
</template>
