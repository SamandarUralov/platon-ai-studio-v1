<script setup lang="ts">
/** Unreleased changes first, then the audit trail. */
import { useI18n } from 'vue-i18n'
import type { LogicKind } from '@platon/definition'
import { PBadge, PSpinner } from '@platon/ui'
import { relTime } from '@/composables/format'
import { useProjectId } from '@/composables/useProject'
import { useHistory } from '../../api'

const props = defineProps<{ kind: LogicKind; id: string }>()
const { t } = useI18n()
const pid = useProjectId()
const hist = useHistory(
  pid,
  () => props.kind,
  () => props.id,
)
</script>

<template>
  <div class="px-4 py-4">
    <div v-if="hist.isLoading.value" class="grid place-items-center py-8"><PSpinner /></div>
    <p v-else-if="!hist.data.value?.length" class="text-sm text-faint">{{ t('logic.history.empty') }}</p>
    <ol v-else class="m-0 list-none border-l border-line p-0 pl-4">
      <li v-for="h in hist.data.value" :key="h.id" class="relative pb-3.5">
        <span
          class="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-surface"
          :class="h.released ? 'bg-faint' : 'bg-warn-dot'"
        />
        <div class="flex items-center gap-2 text-sm font-semibold text-fg">
          {{ h.text
          }}<PBadge v-if="!h.released" tone="warn" size="xs">{{ t('logic.history.unreleased') }}</PBadge>
        </div>
        <div class="text-xs text-faint">{{ relTime(h.at) }} · {{ h.who }}</div>
      </li>
    </ol>
  </div>
</template>
