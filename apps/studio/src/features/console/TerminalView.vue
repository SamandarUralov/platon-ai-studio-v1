<script setup lang="ts">
/** Terminal tab: a small Development shell over the definition and the mock runtime. */
import { nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDefinitionStore } from '@/stores/definition'
import { useSessionStore } from '@/stores/session'
import { errorMessage } from '@/services/http'
import { useConsoleStore } from './useConsoleLog'
import { execute, historyStep, type LineTone, type ShellContext } from './terminal'
import { shellCall, shellQuery } from './api'
import type { useTests } from './useTests'

const props = defineProps<{ tests: ReturnType<typeof useTests> }>()
const { t } = useI18n()
const def = useDefinitionStore()
const session = useSessionStore()
const store = useConsoleStore()

const input = ref('')
const busy = ref(false)
const el = ref<HTMLInputElement>()
let hIndex = store.shellHistory.length

const TONE: Record<LineTone, string> = {
  cmd: 'text-code-fg font-semibold',
  out: 'text-code-fg',
  muted: 'text-code-muted',
  ok: 'text-ok-dot',
  err: 'text-danger-bg dark:text-danger',
  accent: 'text-primary-ring dark:text-primary-strong',
}

const prompt = () => `${def.definition?.settings.slug ?? def.projectId ?? 'app'} (dev) $`

onMounted(() => {
  if (!store.shellLines.length)
    store.shellLines = [
      { text: t('console.shellHello', { app: def.definition?.name ?? '' }), tone: 'muted' },
      { text: t('console.shellHint'), tone: 'muted' },
    ]
  el.value?.focus()
})

async function submit() {
  const line = input.value
  if (busy.value || !def.definition || !def.projectId) return
  const pid = def.projectId
  input.value = ''
  if (line.trim())
    store.shellHistory = [...store.shellHistory.filter((h) => h !== line.trim()), line.trim()].slice(-100)
  hIndex = store.shellHistory.length
  store.shellLines = [...store.shellLines, { text: `${prompt()} ${line}`, tone: 'cmd' }]
  const ctx: ShellContext = {
    def: def.definition,
    env: 'development',
    role: session.user?.role ?? 'viewer',
    projectName: def.definition.name,
    problems: def.problems,
    call: (fn, args) => shellCall(pid, { fn, args }),
    query: (sql) => shellQuery(pid, { sql }),
    runTests: (f) => props.tests.runMatching(f),
    errorText: errorMessage,
  }
  busy.value = true
  try {
    const out = await execute(line, ctx)
    store.shellLines = out === 'clear' ? [] : [...store.shellLines, ...out].slice(-2000)
  } finally {
    busy.value = false
    await nextTick()
    el.value?.focus()
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const s = historyStep(store.shellHistory, hIndex, e.key === 'ArrowUp' ? -1 : 1)
    hIndex = s.index
    input.value = s.value
  } else if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault()
    store.shellLines = []
  }
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 cursor-text flex-col-reverse overflow-auto font-mono text-[12.5px] leading-[1.55] scroll-thin"
    @click="el?.focus()"
  >
    <div class="px-3.5 py-2">
      <div
        v-for="(l, i) in store.shellLines"
        :key="i"
        class="whitespace-pre-wrap break-words"
        :class="TONE[l.tone]"
      >
        {{ l.text || ' ' }}
      </div>
      <form class="flex items-center gap-2" @submit.prevent="submit">
        <label :for="'shell-in'" class="shrink-0 text-ok-dot">{{ prompt() }}</label>
        <input
          id="shell-in"
          ref="el"
          v-model="input"
          autocomplete="off"
          spellcheck="false"
          :placeholder="busy ? t('console.shellBusy') : t('console.shellPlaceholder')"
          :readonly="busy"
          class="min-w-0 flex-1 border-none bg-transparent p-0 text-code-fg outline-none placeholder:text-code-muted"
          @keydown="onKey"
        />
      </form>
    </div>
  </div>
</template>
