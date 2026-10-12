<script setup lang="ts">
/**
 * Advanced · one page edited as JSON (paste a whole page, or tweak what the visual editor has no
 * control for). Apply checks it (see pageJson.ts) and records a single replace change, so it lands
 * in the change log, undo and save like any other edit.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Check, RotateCcw, WandSparkles, X } from 'lucide-vue-next'
import { PButton, PTextarea, toast } from '@platon/ui'
import { pointer, type Page } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { checkPageJson, type PageIssue } from './pageJson'

const props = defineProps<{ page: Page }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const def = useDefinitionStore()

const pretty = (v: unknown) => JSON.stringify(v, null, 2)
const text = ref(pretty(props.page))
const issues = ref<PageIssue[]>([])
const changed = computed(() => text.value !== pretty(props.page))

function format() {
  try {
    text.value = pretty(JSON.parse(text.value))
    issues.value = []
  } catch (e) {
    issues.value = [{ key: 'json', params: { message: e instanceof Error ? e.message : String(e) } }]
  }
}

function reset() {
  text.value = pretty(props.page)
  issues.value = []
}

function apply() {
  const doc = def.definition
  if (!doc) return
  const r = checkPageJson(text.value, doc, props.page.id)
  if (!r.ok) {
    issues.value = r.issues
    return
  }
  issues.value = []
  if (pretty(r.page) === pretty(props.page)) return emit('close')
  // Its own key: `interface.pages.<id>` belongs to add / delete page, which this must not replace.
  const key = `interface.pages.${props.page.id}.json`
  const ok = def.apply({
    key,
    area: 'Pages',
    text: t('advanced.edit.change', { page: r.page.name }),
    machinePath: `~ ${key}`,
    ops: [{ op: 'replace', path: pointer('interface', 'pages', props.page.id), value: r.page }],
  })
  if (!ok) return
  toast(t('advanced.edit.applied', { page: r.page.name }), { tone: 'ok' })
  emit('close')
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <PButton variant="primary" :icon="Check" @click="apply">{{ t('advanced.edit.apply') }}</PButton>
      <PButton :icon="WandSparkles" @click="format">{{ t('advanced.edit.format') }}</PButton>
      <PButton :icon="RotateCcw" :disabled="!changed" @click="reset">{{ t('advanced.edit.reset') }}</PButton>
      <PButton variant="ghost" :icon="X" @click="emit('close')">{{ t('advanced.edit.cancel') }}</PButton>
      <span class="ml-auto text-xs text-faint">{{ t('advanced.edit.hint') }}</span>
    </div>

    <div
      v-if="issues.length"
      class="rounded-[10px] border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-sm text-danger"
      role="alert"
    >
      <div class="flex items-center gap-2 font-semibold">
        <AlertTriangle :size="14" class="shrink-0" />{{ t('advanced.edit.issues', { n: issues.length }) }}
      </div>
      <ul class="mt-1.5 max-h-48 list-disc space-y-0.5 overflow-auto pl-6 scroll-thin">
        <li v-for="(i, n) in issues.slice(0, 50)" :key="n">
          {{ t(`advanced.edit.issue.${i.key}`, i.params) }}
        </li>
      </ul>
    </div>

    <PTextarea
      v-model="text"
      mono
      spellcheck="false"
      :invalid="issues.length > 0"
      :aria-label="t('advanced.edit.label', { page: page.name })"
      class="h-[62vh] min-h-80"
    />
  </div>
</template>
