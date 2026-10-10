<script setup lang="ts">
/** Recent requests to this API across environments. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn, PSpinner, toneClasses } from '@platon/ui'
import { ENVIRONMENTS } from '@platon/definition'
import { relTime } from '@/composables/format'
import { useProjectId } from '@/composables/useProject'
import { useRuns } from '../../api'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const pid = useProjectId()
const runs = useRuns(pid, 'apis', () => props.id)
const items = computed(() => runs.data.value ?? [])
const ok = computed(() => items.value.filter((r) => r.ok).length)
const p50 = computed(() => {
  const ms = items.value.map((r) => r.ms).sort((a, b) => a - b)
  return ms.length ? ms[Math.floor(ms.length / 2)] : 0
})
const env = (e: string) => ENVIRONMENTS.find((x) => x.id === e)?.label ?? e
</script>

<template>
  <div class="px-4 py-4">
    <div v-if="runs.isLoading.value" class="grid place-items-center py-8"><PSpinner /></div>
    <template v-else>
      <p class="mb-3 text-sm text-muted">
        {{
          items.length ? t('logic.runs.summary', { n: items.length, ok: ok, ms: p50 }) : t('logic.runs.empty')
        }}
      </p>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li
          v-for="r in items"
          :key="r.id"
          class="flex items-center gap-2.5 rounded-lg border border-line-soft px-2.5 py-2"
        >
          <span
            :class="
              cn(
                'w-[54px] shrink-0 rounded-md py-0.5 text-center font-mono text-xs font-bold',
                toneClasses[r.ok ? 'ok' : r.status.startsWith('4') ? 'warn' : 'danger'].bg,
                toneClasses[r.ok ? 'ok' : r.status.startsWith('4') ? 'warn' : 'danger'].fg,
              )
            "
            >{{ r.status }}</span
          >
          <span class="min-w-0 flex-1 truncate text-sm">{{ relTime(r.at) }} · {{ env(r.env) }}</span>
          <span class="font-mono text-xs text-muted">{{ r.ms }} ms</span>
        </li>
      </ul>
    </template>
  </div>
</template>
