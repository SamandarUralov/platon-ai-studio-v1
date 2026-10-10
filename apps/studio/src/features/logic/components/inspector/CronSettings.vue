<script setup lang="ts">
/** Cron settings: name, schedule (with human text and next runs), timezone. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarClock, CircleAlert } from 'lucide-vue-next'
import type { Cron } from '@platon/definition'
import { cn, PField, PInput, PSelect } from '@platon/ui'
import { CRON_PRESETS, describeCron, formatRun, nextRuns, TIMEZONES } from '../../lib/cron'
import DeleteItem from '../DeleteItem.vue'

const props = defineProps<{ cron: Cron }>()
const emit = defineEmits<{ edit: [fn: (c: Cron) => Cron]; remove: [] }>()
const { t } = useI18n()

const human = computed(() => describeCron(props.cron.schedule))
const runs = computed(() => (props.cron.enabled ? nextRuns(props.cron.schedule, props.cron.timezone, 3) : []))
const zones = computed(() =>
  [...new Set([props.cron.timezone, ...TIMEZONES])].map((z) => ({ value: z, label: z })),
)

function set<K extends keyof Cron>(k: K, v: Cron[K]) {
  emit('edit', (c) => ({ ...c, [k]: v }))
}
</script>

<template>
  <div class="flex flex-col">
    <div class="border-b border-line-faint px-4 py-3">
      <div class="text-md font-bold">{{ t('logic.cron.settings') }}</div>
      <div class="truncate text-xs text-faint">{{ human ?? cron.schedule }}</div>
    </div>
    <div class="flex flex-col gap-3.5 px-4 py-4">
      <PField :label="t('logic.fnSettings.name')">
        <PInput :model-value="cron.name" @update:model-value="set('name', String($event ?? ''))" />
      </PField>
      <PField :label="t('logic.cron.schedule')" :hint="t('logic.cron.scheduleHint')">
        <PInput
          mono
          :invalid="!human"
          :model-value="cron.schedule"
          @update:model-value="set('schedule', String($event ?? ''))"
        />
      </PField>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="p in CRON_PRESETS"
          :key="p.value"
          type="button"
          :class="
            cn(
              'rounded-full border px-2.5 py-1 text-xs font-semibold',
              p.value === cron.schedule
                ? 'border-primary-ring bg-primary-tint text-primary-strong'
                : 'border-line text-muted hover:bg-hover',
            )
          "
          @click="set('schedule', p.value)"
        >
          {{ p.label }}
        </button>
      </div>
      <div class="rounded-lg border border-line-soft bg-subtle p-3">
        <div v-if="human" class="flex items-start gap-2 text-md font-semibold text-fg">
          <CalendarClock :size="15" class="mt-0.5 shrink-0 text-primary" />{{ human }}
        </div>
        <div v-else class="flex items-center gap-2 text-sm text-danger">
          <CircleAlert :size="14" />{{ t('logic.cron.invalid') }}
        </div>
        <div v-if="!cron.enabled" class="mt-2 text-sm text-faint">{{ t('logic.cron.pausedNoRuns') }}</div>
        <ul v-else-if="runs.length" class="m-0 mt-2 list-none space-y-0.5 p-0">
          <li class="eyebrow">{{ t('logic.cron.nextRuns') }}</li>
          <li v-for="r in runs" :key="r.getTime()" class="font-mono text-sm text-fg-2">
            {{ formatRun(r, cron.timezone) }}
          </li>
        </ul>
      </div>
      <PField :label="t('logic.cron.timezone')">
        <PSelect
          :model-value="cron.timezone"
          :options="zones"
          @update:model-value="set('timezone', $event ?? 'UTC')"
        />
      </PField>
    </div>
    <DeleteItem :name="cron.name" :noun="t('logic.noun.crons')" @confirm="emit('remove')" />
  </div>
</template>
