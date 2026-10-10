<script setup lang="ts">
/** One lifecycle handler: a Logic function with parameter mapping, or inline code with ctx autocomplete. */
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import type * as Monaco from 'monaco-editor'
import { ArrowDown, ArrowUp, Braces, CircleCheck, Code, Maximize2, TriangleAlert, X } from 'lucide-vue-next'
import { PCodeEditor, PDialog, PSegmented, PSelect } from '@platon/ui'
import type { LifecycleHandler, LogicFunction, Page } from '@platon/definition'
import { scriptProblems } from '@platon/validators'
import { useDefinitionStore } from '@/stores/definition'
import { setCtxLib, setProblemMarkers } from '../code/monaco'
import { ctxTypings, signature } from '../lib/script'
import { newHandler, withFunction } from '../lib/lifecycle'

const props = defineProps<{
  page: Page
  hook: string
  handler: LifecycleHandler
  index: number
  total: number
}>()
const emit = defineEmits<{ change: [h: LifecycleHandler]; remove: []; move: [dir: -1 | 1] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const fns = computed<LogicFunction[]>(() => def.definition?.logic.functions ?? [])
const fn = computed(() => fns.value.find((f) => f.name === props.handler.fn))
const fnOptions = computed(() => fns.value.map((f) => ({ value: f.name, label: `${f.name}${signature(f)}` })))
const kinds = computed(() => [
  { value: 'function' as const, label: t('interface.lc.fn'), icon: Braces },
  { value: 'code' as const, label: t('interface.lc.code'), icon: Code },
])

const kind = computed({
  get: () => props.handler.kind,
  set: (k) =>
    emit(
      'change',
      k === 'function'
        ? fns.value[0]
          ? withFunction(props.handler, fns.value[0])
          : { ...newHandler('function'), id: props.handler.id }
        : { id: props.handler.id, kind: 'code', code: props.handler.code ?? '' },
    ),
})

// Code: edit locally, commit after a pause so one typing burst is one change.
const code = ref(props.handler.code ?? '')
watch(
  () => props.handler.code,
  (c) => {
    if ((c ?? '') !== code.value) code.value = c ?? ''
  },
)
const commit = useDebounceFn(() => {
  if (code.value !== (props.handler.code ?? '')) emit('change', { ...props.handler, code: code.value })
}, 600)
watch(code, () => void commit())

const problems = computed(() =>
  def.definition && props.handler.kind === 'code'
    ? scriptProblems(props.page, code.value, def.definition, '')
    : [],
)
const full = ref(false)

const ed = shallowRef<{ editor: Monaco.editor.IStandaloneCodeEditor; monaco: typeof Monaco } | null>(null)
function onReady(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
  if (def.definition) setCtxLib(monaco, ctxTypings(props.page, def.definition))
  ed.value = { editor, monaco }
  // Inline snippets are short: wrap instead of scrolling sideways in the narrow panel.
  if (!full.value) editor.updateOptions({ wordWrap: 'on', folding: false, lineDecorationsWidth: 6 })
}
watch(
  [problems, ed],
  () => ed.value && setProblemMarkers(ed.value.monaco, ed.value.editor.getModel(), problems.value),
)

function setArg(name: string, v: string) {
  emit('change', { ...props.handler, args: { ...(props.handler.args ?? {}), [name]: v } })
}
</script>

<template>
  <div class="rounded-xl border border-line bg-surface p-2">
    <div class="flex items-center gap-1.5">
      <span
        class="grid h-6 min-w-6 place-items-center rounded-md bg-subtle font-mono text-xs font-bold text-muted"
        >{{ index + 1 }}</span
      >
      <PSegmented v-model="kind" :options="kinds" class="flex-1" block :aria-label="t('interface.lc.kind')" />
      <button
        v-if="index > 0"
        type="button"
        class="grid size-6 place-items-center rounded-md text-muted hover:bg-hover"
        :aria-label="t('interface.lc.up')"
        @click="emit('move', -1)"
      >
        <ArrowUp :size="13" />
      </button>
      <button
        v-if="index < total - 1"
        type="button"
        class="grid size-6 place-items-center rounded-md text-muted hover:bg-hover"
        :aria-label="t('interface.lc.down')"
        @click="emit('move', 1)"
      >
        <ArrowDown :size="13" />
      </button>
      <button
        type="button"
        class="grid size-6 place-items-center rounded-md text-muted hover:bg-danger-bg hover:text-danger"
        :aria-label="t('interface.lc.remove')"
        @click="emit('remove')"
      >
        <X :size="14" />
      </button>
    </div>

    <div v-if="handler.kind === 'function'" class="mt-2 space-y-2">
      <PSelect
        :model-value="handler.fn"
        :options="fnOptions"
        size="sm"
        :placeholder="t('interface.lc.pickFn')"
        @update:model-value="
          (v) =>
            v &&
            emit(
              'change',
              withFunction(
                handler,
                fns.find((f) => f.name === v)!,
              ),
            )
        "
      />
      <template v-if="fn">
        <div v-if="fn.params.length" class="rounded-lg bg-subtle p-2">
          <div class="eyebrow mb-1.5">{{ t('interface.lc.params') }}</div>
          <label v-for="p in fn.params" :key="p.name" class="mb-1 flex items-center gap-2 last:mb-0">
            <span class="w-24 shrink-0 truncate font-mono text-xs"
              >{{ p.name }}<span class="text-faint">: {{ p.type }}</span></span
            >
            <input
              :value="handler.args?.[p.name] ?? ''"
              :placeholder="p.req ? 'ctx.state.…' : t('interface.lc.optional')"
              class="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 font-mono text-xs outline-none focus:border-primary"
              @change="setArg(p.name, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
        <p v-else class="text-xs text-faint">{{ t('interface.lc.noParams') }}</p>
        <p class="text-xs text-faint">
          {{ t('interface.lc.returns') }} <span class="font-mono text-muted">{{ fn.returns.type }}</span>
        </p>
      </template>
    </div>

    <div v-else class="mt-2 overflow-hidden rounded-lg bg-code-bg">
      <div v-if="full" class="px-3 py-6 text-center text-xs text-code-muted">
        {{ t('interface.lc.inFull') }}
      </div>
      <div v-else class="h-36">
        <PCodeEditor v-model="code" :line-numbers="false" :font-size="12" @ready="onReady" />
      </div>
      <div class="flex items-center gap-2 border-t border-code-line px-2.5 py-1.5 text-xs">
        <span v-if="!problems.length" class="flex items-center gap-1 text-code-muted"
          ><CircleCheck :size="12" class="text-ok-dot" />{{ t('interface.lc.noProblems') }}</span
        >
        <span v-else class="flex min-w-0 items-center gap-1 text-danger-dot"
          ><TriangleAlert :size="12" /><span class="truncate">{{ problems[0]!.message }}</span></span
        >
        <button
          type="button"
          class="ml-auto flex items-center gap-1 font-semibold text-primary-strong hover:underline"
          @click="full = true"
        >
          <Maximize2 :size="12" />{{ t('interface.lc.fullEditor') }}
        </button>
      </div>
    </div>

    <PDialog
      v-model:open="full"
      :title="`${hook} · ${t('interface.lc.handler', { n: index + 1 })}`"
      :description="t('interface.lc.fullHint')"
      :width="820"
      body-class="p-0"
    >
      <div class="h-[60vh]">
        <PCodeEditor
          v-model="code"
          :path="`lifecycle/${page.id}/${handler.id}.js`"
          @ready="onReady"
          @save="full = false"
        />
      </div>
    </PDialog>
  </div>
</template>
