<script setup lang="ts">
/** Send a test request in Development: fill inputs, see status, time, body and per-layer trace. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Send } from 'lucide-vue-next'
import { STEPS, type Api, type TypedField } from '@platon/definition'
import { cn, PButton, PInput, toast, toneClasses } from '@platon/ui'
import JsonView from '@/components/common/JsonView.vue'
import { errorMessage } from '@/services/http'
import { useProjectId } from '@/composables/useProject'
import { useTestRun } from '../../api'
import { useLogicEditor } from '../../store'
import { apiLabel, PROTO_CODES } from '../../lib/apis'

const props = defineProps<{ api: Api; path: string }>()
const { t } = useI18n()
const ed = useLogicEditor()
const pid = useProjectId()
const test = useTestRun(pid)

const groups = computed(() =>
  (['path', 'query', 'headers', 'body'] as const)
    .map((k) => ({ k, fields: props.api.request[k] }))
    .filter((g) => g.fields.length),
)
const SAMPLE: Record<string, string> = {
  id: 'WO-1042',
  order_id: 'WO-1042',
  status: 'in_progress',
  trade: 'HVAC',
  site_id: 'site_018',
  priority: 'urgent',
  description: 'Rooftop unit not cooling',
  event: 'part.shipped',
}
const value = (f: TypedField) => ed.testInputs[props.path]?.[f.name] ?? SAMPLE[f.name] ?? ''
function setValue(f: TypedField, v: unknown) {
  ed.testInputs = {
    ...ed.testInputs,
    [props.path]: { ...(ed.testInputs[props.path] ?? {}), [f.name]: String(v ?? '') },
  }
}

const last = computed(() => ed.tests[props.path]?.res)
const okCode = computed(() => PROTO_CODES[props.api.protocol][0])
const tone = computed(() =>
  !last.value
    ? 'neutral'
    : last.value.ok
      ? 'ok'
      : /^4|INVALID|-32602|Fault/.test(last.value.status) && !last.value.error
        ? 'warn'
        : 'danger',
)

async function send() {
  const input: Record<string, string> = {}
  for (const g of groups.value) for (const f of g.fields) input[f.name] = value(f)
  try {
    const res = await test.mutateAsync({
      kind: 'apis',
      id: props.api.id,
      verb: 'test',
      req: { input, item: props.api },
    })
    ed.setTest(props.path, { res, sig: JSON.stringify(props.api.steps) })
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 px-4 py-4">
    <div class="truncate rounded-lg bg-subtle px-2.5 py-2 font-mono text-sm">
      {{ apiLabel(api).badge }} {{ apiLabel(api).text }}
    </div>
    <div v-for="g in groups" :key="g.k" class="flex flex-col gap-2">
      <div class="eyebrow">{{ t(`logic.api.req.${g.k}`) }}</div>
      <label v-for="f in g.fields" :key="f.name" class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-fg-2"
          >{{ f.name }}
          <span class="font-mono font-medium text-faint">{{ f.type }}{{ f.req ? '' : '?' }}</span></span
        >
        <PInput
          size="sm"
          mono
          :model-value="value(f)"
          @update:model-value="setValue(f, $event)"
          @keydown.enter="send"
        />
      </label>
    </div>
    <p v-if="!groups.length" class="text-sm text-faint">{{ t('logic.test.noParams') }}</p>
    <PButton variant="primary" :icon="Send" :loading="test.isPending.value" @click="send">{{
      last ? t('logic.api.sendAgain') : t('logic.api.send')
    }}</PButton>

    <template v-if="last">
      <div class="flex items-center gap-2">
        <span
          :class="
            cn(
              'rounded-md px-2 py-0.5 font-mono text-sm font-bold',
              toneClasses[tone].bg,
              toneClasses[tone].fg,
            )
          "
          >{{ last.status }}</span
        >
        <span class="text-sm text-muted">{{ last.ms }} ms · Development</span>
        <span v-if="last.status !== okCode && last.error" class="truncate text-xs text-danger">{{
          last.error.message
        }}</span>
      </div>
      <JsonView :value="last.output" max-height="260px" />
      <div v-if="last.trace.length" class="flex flex-col gap-1">
        <div class="eyebrow">{{ t('logic.test.trace') }}</div>
        <button
          v-for="s in last.trace"
          :key="s.stepId"
          type="button"
          class="flex items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-hover"
          :class="s.status === 'skip' && 'opacity-50'"
          @click="ed.select(path, s.stepId)"
        >
          <span
            :class="
              cn(
                'size-1.5 shrink-0 rounded-full',
                toneClasses[s.status === 'fail' ? 'danger' : s.status === 'skip' ? 'neutral' : 'ok'].dot,
              )
            "
          />
          <span class="truncate">{{ STEPS[s.type].label }}</span>
          <span v-if="s.into" class="truncate font-mono text-xs text-faint">→ {{ s.into }}</span>
          <span class="ml-auto font-mono text-xs text-muted">{{
            s.status === 'skip' ? t('logic.test.skipped') : `${s.ms} ms`
          }}</span>
        </button>
      </div>
    </template>
  </div>
</template>
