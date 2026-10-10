<script setup lang="ts">
/**
 * Thin Monaco wrapper. Loads Monaco on mount (code-split), keeps v-model in sync,
 * exposes the instance for features that need markers, decorations or extra libs.
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type * as Monaco from 'monaco-editor'
import PSpinner from './PSpinner.vue'

const props = withDefaults(
  defineProps<{
    language?: 'javascript' | 'typescript' | 'json' | 'sql' | 'markdown' | 'yaml' | 'xml' | 'plaintext'
    readonly?: boolean
    /** Unique model path; lets Monaco keep per-file state and resolve extra libs. */
    path?: string
    minimap?: boolean
    lineNumbers?: boolean
    fontSize?: number
  }>(),
  { language: 'javascript', minimap: false, lineNumbers: true, fontSize: 13 },
)
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{
  save: []
  ready: [editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco]
  cursor: [line: number, column: number]
}>()

const host = ref<HTMLDivElement>()
const editor = shallowRef<Monaco.editor.IStandaloneCodeEditor>()
const monacoRef = shallowRef<typeof Monaco>()
const loading = ref(true)
let syncing = false

onMounted(async () => {
  const { setupMonaco } = await import('../monaco/setup')
  const monaco = setupMonaco()
  monacoRef.value = monaco
  if (!host.value) return
  const uri = props.path ? monaco.Uri.parse(`file:///${props.path}`) : undefined
  const existing = uri ? monaco.editor.getModel(uri) : null
  const textModel = existing ?? monaco.editor.createModel(model.value, props.language, uri)
  if (existing) existing.setValue(model.value)

  editor.value = monaco.editor.create(host.value, {
    model: textModel,
    theme: 'platon-dark',
    readOnly: props.readonly,
    automaticLayout: true,
    minimap: { enabled: props.minimap },
    lineNumbers: props.lineNumbers ? 'on' : 'off',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: props.fontSize,
    lineHeight: 20,
    tabSize: 2,
    scrollBeyondLastLine: false,
    renderLineHighlight: 'line',
    padding: { top: 10, bottom: 10 },
    folding: true,
    formatOnPaste: true,
    fixedOverflowWidgets: true,
  })
  editor.value.onDidChangeModelContent(() => {
    if (syncing) return
    model.value = editor.value!.getValue()
  })
  editor.value.onDidChangeCursorPosition((e) => emit('cursor', e.position.lineNumber, e.position.column))
  editor.value.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => emit('save'))
  loading.value = false
  emit('ready', editor.value, monaco)
})

watch(model, (v) => {
  const ed = editor.value
  if (!ed || ed.getValue() === v) return
  syncing = true
  ed.setValue(v ?? '')
  syncing = false
})

watch(
  () => props.readonly,
  (ro) => editor.value?.updateOptions({ readOnly: ro }),
)

onBeforeUnmount(() => {
  const m = editor.value?.getModel()
  editor.value?.dispose()
  // Path-less models are throwaway; path models are kept for undo history across tabs.
  if (!props.path) m?.dispose()
})

defineExpose({ editor, monaco: monacoRef })
</script>

<template>
  <div class="relative h-full min-h-0 w-full bg-code-bg">
    <div ref="host" class="absolute inset-0" />
    <div v-if="loading" class="absolute inset-0 grid place-items-center text-code-muted">
      <PSpinner :size="18" />
    </div>
  </div>
</template>
