<script setup lang="ts">
/** Inspector for the selected block: Content, Style, Visibility, Events and actions. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Braces, Sparkles, Trash2 } from 'lucide-vue-next'
import { PButton, PCollapsible, PDialog, PIcon } from '@platon/ui'
import { BLOCKS, type Block, type Page } from '@platon/definition'
import { changedStyleCount } from '@platon/renderer'
import JsonView from '@/components/common/JsonView.vue'
import { useInterfaceStore } from '../store'
import { useInterfaceEdits } from '../composables/useInterfaceEdits'
import ContentFields from './inspector/ContentFields.vue'
import StyleFields from './inspector/StyleFields.vue'
import VisibilityFields from './inspector/VisibilityFields.vue'
import EventsList from './inspector/EventsList.vue'
import { isRestricted } from './inspector/visibility'

const props = defineProps<{ page: Page; block: Block }>()
const emit = defineEmits<{ askAi: [] }>()
const { t } = useI18n()
const ui = useInterfaceStore()
const edits = useInterfaceEdits()
const meta = computed(() => BLOCKS[props.block.type])
const styleCount = computed(() => changedStyleCount(props.block.style))
const open = ref({ content: true, style: false, vis: true, events: true })
const showDef = ref(false)
function remove() {
  edits.deleteBlock(props.page, props.block)
  ui.select(null)
}
</script>

<template>
  <div class="flex items-center gap-3 border-b border-line-faint px-3.5 py-3">
    <span class="grid size-9 place-items-center rounded-[10px] bg-primary-tint text-primary-strong"
      ><PIcon :name="meta.icon" :size="17"
    /></span>
    <div class="min-w-0">
      <div class="truncate text-md font-bold">{{ meta.label }}</div>
      <div class="truncate text-xs text-faint">{{ t('interface.insp.onPage', { page: page.name }) }}</div>
    </div>
  </div>
  <PCollapsible v-model:open="open.content" :title="t('interface.insp.content')">
    <ContentFields :page="page" :block="block" />
  </PCollapsible>
  <PCollapsible v-model:open="open.style" :title="t('interface.insp.style')">
    <template #actions
      ><span class="text-xs text-faint">{{
        styleCount ? t('interface.insp.changed', { n: styleCount }) : t('interface.insp.default')
      }}</span></template
    >
    <StyleFields :page="page" :block="block" />
  </PCollapsible>
  <PCollapsible v-model:open="open.vis" :title="t('interface.insp.visibility')">
    <template #actions>
      <span
        class="text-xs font-semibold"
        :class="isRestricted(block) ? 'text-purple' : 'text-primary-strong'"
        >{{ isRestricted(block) ? t('interface.insp.restricted') : t('interface.insp.everyone') }}</span
      >
    </template>
    <VisibilityFields :page="page" :block="block" />
  </PCollapsible>
  <PCollapsible
    v-model:open="open.events"
    :title="t('interface.insp.events')"
    :count="meta.events.length || undefined"
  >
    <EventsList :page="page" :block="block" />
  </PCollapsible>
  <div class="space-y-1 px-3.5 py-3.5">
    <PButton variant="tint" :icon="Sparkles" class="w-full justify-start" @click="emit('askAi')">{{
      t('interface.insp.askAi')
    }}</PButton>
    <div class="grid grid-cols-2 gap-1">
      <PButton variant="ghost" :icon="Braces" @click="showDef = true">{{
        t('interface.insp.viewDef')
      }}</PButton>
      <PButton variant="ghost" :icon="Trash2" class="text-danger" @click="remove">{{
        t('interface.insp.delete')
      }}</PButton>
    </div>
  </div>
  <PDialog
    v-model:open="showDef"
    :title="t('interface.insp.defTitle', { ref: block.ref })"
    :description="`/interface/pages/${page.id}/blocks/${block.id}`"
    :icon="Braces"
    :width="640"
  >
    <JsonView :value="block" max-height="60vh" />
  </PDialog>
</template>
