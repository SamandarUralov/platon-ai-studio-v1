<script setup lang="ts">
/** "New Vue component": generate with Studio AI or start from a hand-written file. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { CodeXml, FileCode2, FilePlus2, Puzzle, Sparkles } from 'lucide-vue-next'
import { PButton, PDialog, PField, PInput, PSegmented, PTextarea, toast } from '@platon/ui'
import type { CustomComponent } from '@platon/definition'
import { errorMessage } from '@/services/http'
import { useDefinitionStore } from '@/stores/definition'
import { componentKeys, saveSandboxFile } from './api'
import { componentNameError, componentPath, scaffoldSource, snakeName } from './sfc'
import { useComponentActions } from './useComponents'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ projectId: string; initialMethod?: 'ai' | 'code' }>()
const emit = defineEmits<{ created: [componentId: string] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const qc = useQueryClient()
const actions = useComponentActions()

const method = ref<'ai' | 'code'>('code')
const name = ref('')
const folder = ref<'components' | 'pages'>('components')
const prompt = ref('')
const busy = ref(false)
const tried = ref(false)

watch(open, (o) => {
  if (!o) return
  method.value = props.initialMethod ?? 'code'
  name.value = ''
  prompt.value = ''
  folder.value = 'components'
  tried.value = false
})

const isAi = computed(() => method.value === 'ai')
const taken = computed(() => def.definition?.components.map((c) => c.name) ?? [])
const nameErr = computed(() => {
  const n = name.value.trim()
  if (isAi.value && !n) return null
  const e = componentNameError(n, taken.value)
  if (e === 'required' && !tried.value) return null
  return e ? t(`components.dialog.err.${e}`) : null
})
const promptErr = computed(() =>
  isAi.value && tried.value && !prompt.value.trim() ? t('components.dialog.err.prompt') : null,
)
const path = computed(() =>
  componentPath(
    folder.value,
    name.value.trim() && !nameErr.value ? name.value.trim() : isAi.value ? '…' : 'Name',
  ),
)
const canSubmit = computed(
  () => !busy.value && !nameErr.value && (isAi.value ? !!prompt.value.trim() : !!name.value.trim()),
)

const METHODS = computed(() => [
  {
    key: 'ai' as const,
    label: t('components.dialog.ai'),
    desc: t('components.dialog.aiDesc'),
    icon: Sparkles,
  },
  {
    key: 'code' as const,
    label: t('components.dialog.code'),
    desc: t('components.dialog.codeDesc'),
    icon: CodeXml,
  },
])
const EXAMPLES = computed(() => [
  t('components.dialog.ex1'),
  t('components.dialog.ex2'),
  t('components.dialog.ex3'),
])
const FOLDERS = computed(() => [
  { value: 'components' as const, label: t('components.dialog.folderComponent') },
  { value: 'pages' as const, label: t('components.dialog.folderPage') },
])

async function submit() {
  tried.value = true
  if (!canSubmit.value) return
  busy.value = true
  try {
    const n = name.value.trim()
    if (isAi.value) {
      const c = await actions.generate(props.projectId, {
        prompt: prompt.value.trim(),
        name: n || undefined,
        folder: folder.value,
      })
      void qc.invalidateQueries({ queryKey: componentKeys.files(props.projectId) })
      open.value = false
      emit('created', c.id)
      return
    }
    const file = componentPath(folder.value, n)
    const c: CustomComponent = {
      id: `component:${snakeName(n)}`,
      kind: 'vue-component',
      name: n,
      folder: folder.value,
      file,
      source: { type: 'code' },
      props: [],
      events: [],
      status: 'needs_review',
    }
    await saveSandboxFile(props.projectId, file, {
      content: scaffoldSource(n),
      componentId: c.id,
      origin: 'code',
    })
    actions.add(c, `Added component “${n}” at ${file}`)
    void qc.invalidateQueries({ queryKey: componentKeys.files(props.projectId) })
    toast(t('components.dialog.created', { path: file }), { tone: 'ok' })
    open.value = false
    emit('created', c.id)
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PDialog
    v-model:open="open"
    :title="t('components.dialog.title')"
    :description="t('components.dialog.lead')"
    :icon="Puzzle"
    :width="580"
  >
    <form id="new-component" class="flex flex-col gap-4" @submit.prevent="submit">
      <div role="radiogroup" :aria-label="t('components.dialog.method')" class="grid grid-cols-2 gap-2.5">
        <button
          v-for="m in METHODS"
          :key="m.key"
          type="button"
          role="radio"
          :aria-checked="method === m.key"
          class="flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors"
          :class="
            method === m.key
              ? 'border-primary bg-primary-tint/50 shadow-focus'
              : 'border-line hover:border-primary-ring'
          "
          @click="method = m.key"
        >
          <span class="flex items-center gap-2 text-md font-bold">
            <component
              :is="m.icon"
              :size="15"
              :class="method === m.key ? (m.key === 'ai' ? 'text-purple' : 'text-primary') : 'text-faint'"
            />{{ m.label }}
          </span>
          <span class="text-sm leading-snug text-muted">{{ m.desc }}</span>
        </button>
      </div>

      <template v-if="isAi">
        <PField :label="t('components.dialog.prompt')" :error="promptErr">
          <template #default="{ id }">
            <PTextarea
              :id="id"
              v-model="prompt"
              rows="3"
              :placeholder="t('components.dialog.promptPh')"
              @keydown.meta.enter="submit"
              @keydown.ctrl.enter="submit"
            />
          </template>
        </PField>
        <div class="-mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="ex in EXAMPLES"
            :key="ex"
            type="button"
            class="h-7 rounded-full border border-line bg-surface px-2.5 text-sm text-fg-2 hover:border-primary-ring hover:text-primary-strong"
            @click="prompt = ex"
          >
            {{ ex }}
          </button>
        </div>
      </template>

      <div class="grid grid-cols-2 gap-2.5">
        <PField
          :label="t('components.dialog.name')"
          :error="nameErr"
          :hint="isAi ? t('components.dialog.nameHintAi') : t('components.dialog.nameHintCode')"
        >
          <template #default="{ id }">
            <PInput
              :id="id"
              :model-value="name"
              mono
              :invalid="!!nameErr"
              :placeholder="isAi ? 'e.g. RatingStars' : 'e.g. SignaturePad'"
              autocomplete="off"
              spellcheck="false"
              @update:model-value="name = String($event ?? '').replace(/\s+/g, '')"
            />
          </template>
        </PField>
        <PField :label="t('components.dialog.folder')">
          <PSegmented v-model="folder" :options="FOLDERS" block :aria-label="t('components.dialog.folder')" />
        </PField>
      </div>

      <div class="flex min-w-0 items-center gap-2 rounded-[10px] bg-subtle px-3 py-2.5 text-sm text-muted">
        <FileCode2 :size="14" class="shrink-0 text-faint" />
        <span class="truncate font-mono text-fg">{{ path }}</span>
        <span class="ml-auto shrink-0">{{
          isAi ? t('components.dialog.afterAi') : t('components.dialog.afterCode')
        }}</span>
      </div>
    </form>
    <template #footer>
      <PButton @click="open = false">{{ t('components.prop.cancel') }}</PButton>
      <PButton
        type="submit"
        form="new-component"
        :variant="isAi ? 'ai' : 'primary'"
        size="md"
        :icon="isAi ? Sparkles : FilePlus2"
        :loading="busy"
        :disabled="!canSubmit && tried"
      >
        {{
          busy && isAi
            ? t('components.dialog.creating', { path })
            : isAi
              ? t('components.dialog.createAi')
              : t('components.dialog.createCode')
        }}
      </PButton>
    </template>
  </PDialog>
</template>
