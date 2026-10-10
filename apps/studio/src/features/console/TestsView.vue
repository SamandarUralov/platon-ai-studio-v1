<script setup lang="ts">
/** Tests tab: definition checks + runtime tests, grouped by the item under test. */
import { useI18n } from 'vue-i18n'
import {
  Braces,
  Circle,
  CircleCheck,
  CircleX,
  LayoutPanelTop,
  ListChecks,
  LoaderCircle,
  Play,
  Plug,
} from 'lucide-vue-next'
import { PSpinner } from '@platon/ui'
import { useConsoleStore } from './useConsoleLog'
import type { useTests } from './useTests'

defineProps<{ tests: ReturnType<typeof useTests> }>()
const { t } = useI18n()
const store = useConsoleStore()

const KIND_ICON = { definition: ListChecks, function: Braces, api: Plug, page: LayoutPanelTop }
const STATE = {
  idle: { icon: Circle, cls: 'text-code-muted' },
  running: { icon: LoaderCircle, cls: 'animate-spin text-primary-ring dark:text-primary-strong' },
  pass: { icon: CircleCheck, cls: 'text-ok-dot' },
  fail: { icon: CircleX, cls: 'text-danger-dot' },
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto py-1.5 text-sm scroll-thin">
    <div v-if="tests.loading.value" class="flex items-center gap-2 px-3.5 py-2 text-code-muted">
      <PSpinner :size="13" />{{ t('console.loadingTests') }}
    </div>
    <section v-for="g in tests.groups.value" :key="g.name">
      <h3
        class="m-0 flex items-center gap-1.5 px-3.5 pb-1 pt-2 text-2xs font-bold uppercase tracking-wider text-code-muted"
      >
        <component :is="KIND_ICON[g.kind]" :size="12" />{{ g.name }}
      </h3>
      <div v-for="x in g.tests" :key="x.id" class="group py-1 pl-6 pr-3.5 hover:bg-code-bg">
        <div class="flex items-center gap-2.5">
          <component
            :is="STATE[store.runs[x.id]?.state ?? 'idle'].icon"
            :size="13"
            :class="STATE[store.runs[x.id]?.state ?? 'idle'].cls"
          />
          <span class="min-w-0 flex-1 truncate text-code-fg">{{ x.name }}</span>
          <span v-if="store.runs[x.id]?.note" class="text-xs text-warn-dot">{{
            store.runs[x.id]!.note
          }}</span>
          <span class="font-mono text-xs text-code-muted">
            {{
              store.runs[x.id]?.state === 'running'
                ? t('console.running')
                : store.runs[x.id]?.ms !== undefined
                  ? `${store.runs[x.id]!.ms} ms`
                  : ''
            }}
          </span>
          <button
            type="button"
            class="grid size-6 place-items-center rounded-md text-code-muted hover:bg-code-sel hover:text-code-fg"
            :title="t('console.runOne')"
            :aria-label="`${t('console.runOne')}: ${x.name}`"
            @click="tests.run([x.id])"
          >
            <Play :size="11" />
          </button>
        </div>
        <pre
          v-if="store.runs[x.id]?.state === 'fail' && store.runs[x.id]?.error"
          class="m-0 ml-6 mt-1 whitespace-pre-wrap rounded-md bg-danger-dot/10 px-2.5 py-1.5 font-mono text-xs text-danger-bg dark:text-danger"
          >{{ store.runs[x.id]!.error }}</pre>
      </div>
    </section>
  </div>
</template>
