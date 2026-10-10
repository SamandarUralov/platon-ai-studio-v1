<script setup lang="ts">
/** Delivery rules of a queue: description, concurrency, retries, backoff, time limit, ordering. */
import { useI18n } from 'vue-i18n'
import type { Queue, QueueSettings } from '@platon/definition'
import { PField, PInput, PSelect, PSwitch, PTextarea } from '@platon/ui'

const props = defineProps<{ queue: Queue; compact?: boolean }>()
const emit = defineEmits<{ edit: [fn: (q: Queue) => Queue] }>()
const { t } = useI18n()

const TIMEOUTS = ['5 s', '10 s', '30 s', '60 s', '5 min'].map((x) => ({ value: x, label: x }))
function set<K extends keyof QueueSettings>(k: K, v: QueueSettings[K]) {
  emit('edit', (q) => ({ ...q, settings: { ...q.settings, [k]: v } }))
}
const num = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)))
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <PField :label="t('logic.fnSettings.description')">
      <PTextarea
        class="min-h-[60px]"
        :model-value="props.queue.description ?? ''"
        :placeholder="t('logic.queue.descPh')"
        @update:model-value="emit('edit', (q) => ({ ...q, description: $event ?? '' }))"
      />
    </PField>
    <div class="grid grid-cols-2 gap-3">
      <PField :label="t('logic.queue.concurrency')"
        ><PInput
          type="number"
          min="1"
          max="100"
          :model-value="queue.settings.concurrency"
          @update:model-value="set('concurrency', num($event, 1, 100))"
      /></PField>
      <PField :label="t('logic.queue.retries')"
        ><PInput
          type="number"
          min="0"
          max="20"
          :model-value="queue.settings.retries"
          @update:model-value="set('retries', num($event, 0, 20))"
      /></PField>
      <PField :label="t('logic.queue.backoff')">
        <PSelect
          :model-value="queue.settings.backoff"
          :options="[
            { value: 'fixed', label: t('logic.queue.fixed') },
            { value: 'exponential', label: t('logic.queue.exponential') },
          ]"
          @update:model-value="$event && set('backoff', $event)"
        />
      </PField>
      <PField :label="t('logic.queue.timeout')"
        ><PSelect
          :model-value="queue.settings.timeout"
          :options="TIMEOUTS"
          @update:model-value="$event && set('timeout', $event)"
      /></PField>
    </div>
    <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3">
      <PSwitch
        :model-value="queue.settings.ordered"
        :label="t('logic.queue.ordered')"
        @update:model-value="set('ordered', $event)"
      />
      <span>
        <span class="block text-md font-semibold">{{ t('logic.queue.ordered') }}</span>
        <span class="block text-xs text-muted">{{ t('logic.queue.orderedHint') }}</span>
      </span>
    </label>
  </div>
</template>
