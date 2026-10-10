<script setup lang="ts">
/** Test run with inputs (Development data, nothing is written); results also mark each layer. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck, CircleX, FlaskConical, Play, X } from 'lucide-vue-next'
import type { LogicFunction, TypedField } from '@platon/definition'
import { cn, PButton, PInput, toast } from '@platon/ui'
import JsonView from '@/components/common/JsonView.vue'
import { errorMessage } from '@/services/http'
import { useProjectId } from '@/composables/useProject'
import { useTestRun } from '../../api'
import { useLogicEditor } from '../../store'

const props = defineProps<{ path: string; id: string; fn: LogicFunction }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const ed = useLogicEditor()
const pid = useProjectId()
const test = useTestRun(pid)

const DEFAULTS: Record<string, string> = {
  order_id: 'WO-1042',
  trade: 'HVAC',
  status: 'open',
  id: 'WO-1042',
  to: '+1 415 555 0142',
  text: 'Your technician is on the way',
}
const value = (f: TypedField) => ed.testInputs[props.path]?.[f.name] ?? DEFAULTS[f.name] ?? ''
function setValue(f: TypedField, v: string | number | null | undefined) {
  ed.testInputs = {
    ...ed.testInputs,
    [props.path]: { ...(ed.testInputs[props.path] ?? {}), [f.name]: String(v ?? '') },
  }
}

const last = computed(() => ed.tests[props.path])
const stale = computed(() => !!last.value && last.value.sig !== JSON.stringify(props.fn.steps))

async function run() {
  const input = Object.fromEntries(props.fn.params.map((f) => [f.name, value(f)]))
  try {
    const res = await test.mutateAsync({
      kind: 'functions',
      id: props.id,
      verb: 'test',
      req: { input, item: props.fn },
    })
    ed.setTest(props.path, { res, sig: JSON.stringify(props.fn.steps) })
    if (!res.ok && res.error?.stepId) ed.select(props.path, res.error.stepId)
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  }
}
defineExpose({ run })
</script>

<template>
  <div class="animate-rise rounded-xl border border-line bg-surface shadow-card">
    <div class="flex items-center gap-2 border-b border-line-faint px-3.5 py-2.5">
      <FlaskConical :size="15" class="text-primary" />
      <span class="text-md font-bold">{{ t('logic.test.title') }}</span>
      <span class="text-xs text-faint">{{ t('logic.test.devNote') }}</span>
      <button
        type="button"
        class="ml-auto grid size-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg"
        :aria-label="t('logic.close')"
        @click="emit('close')"
      >
        <X :size="14" />
      </button>
    </div>
    <div class="flex flex-wrap items-end gap-2.5 px-3.5 py-3">
      <label v-for="f in fn.params" :key="f.name" class="flex min-w-[160px] flex-1 flex-col gap-1">
        <span class="text-xs font-semibold text-fg-2"
          >{{ f.name }} <span class="font-mono font-medium text-faint">{{ f.type }}</span></span
        >
        <PInput
          size="sm"
          mono
          :model-value="value(f)"
          @update:model-value="setValue(f, $event)"
          @keydown.enter="run"
        />
      </label>
      <div v-if="!fn.params.length" class="flex-1 text-sm text-faint">{{ t('logic.test.noInputs') }}</div>
      <PButton variant="primary" :icon="Play" :loading="test.isPending.value" @click="run">{{
        last ? t('logic.test.runAgain') : t('logic.test.run')
      }}</PButton>
    </div>
    <div v-if="last" class="border-t border-line-faint px-3.5 py-3">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span
          :class="
            cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-bold',
              last.res.ok ? 'bg-ok-bg text-ok' : 'bg-danger-bg text-danger',
            )
          "
        >
          <component :is="last.res.ok ? CircleCheck : CircleX" :size="13" />
          {{
            last.res.ok
              ? t('logic.test.succeeded')
              : t('logic.test.failedAt', { n: last.res.failIndex ?? '?' })
          }}
        </span>
        <span class="text-xs text-muted">{{
          t('logic.test.meta', {
            ran: last.res.ran,
            total: last.res.total,
            ms: last.res.ms,
            n: last.res.n,
            at: new Date(last.res.at).toLocaleTimeString(),
          })
        }}</span>
        <span v-if="stale" class="rounded-md bg-warn-bg px-1.5 py-0.5 text-2xs font-semibold text-warn">{{
          t('logic.test.stale')
        }}</span>
        <PButton class="ml-auto" size="xs" variant="ghost" @click="ed.setTest(path, null)">{{
          t('logic.test.clear')
        }}</PButton>
      </div>
      <div class="eyebrow mb-1">{{ last.res.ok ? t('logic.test.returned') : t('logic.test.error') }}</div>
      <JsonView :value="last.res.ok ? last.res.output : last.res.error" max-height="220px" />
    </div>
  </div>
</template>
