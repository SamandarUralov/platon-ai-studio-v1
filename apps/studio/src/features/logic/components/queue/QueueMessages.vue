<script setup lang="ts">
/** Recent messages in Development with status, attempts and contents; replay or delete. */
import { useI18n } from 'vue-i18n'
import { RotateCcw, Trash2 } from 'lucide-vue-next'
import type { QueueMessage, QueueMessageStatus } from '@platon/definition'
import { PBadge, PButton, PSpinner, type Tone } from '@platon/ui'
import { relTime } from '@/composables/format'

defineProps<{ messages: QueueMessage[]; loading: boolean }>()
const emit = defineEmits<{ replay: [id: string]; remove: [id: string] }>()
const { t } = useI18n()
const TONE: Record<QueueMessageStatus, Tone> = {
  waiting: 'info',
  delivered: 'ok',
  retrying: 'warn',
  dead: 'danger',
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line bg-surface">
    <div v-if="loading" class="grid place-items-center py-10"><PSpinner /></div>
    <table v-else class="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr class="border-b border-line-soft text-left text-2xs uppercase tracking-wide text-faint-2">
          <th class="w-[110px] px-3 py-2 font-bold">{{ t('logic.queue.msg.id') }}</th>
          <th class="w-[110px] px-3 py-2 font-bold">{{ t('logic.queue.msg.received') }}</th>
          <th class="w-[110px] px-3 py-2 font-bold">{{ t('logic.queue.msg.status') }}</th>
          <th class="w-[76px] px-3 py-2 font-bold">{{ t('logic.queue.msg.attempts') }}</th>
          <th class="px-3 py-2 font-bold">{{ t('logic.queue.msg.contents') }}</th>
          <th class="w-[112px] px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="m in messages"
          :key="m.id"
          class="border-b border-line-faint last:border-b-0 hover:bg-hover"
        >
          <td class="truncate px-3 py-2 font-mono text-xs">{{ m.id }}</td>
          <td class="truncate px-3 py-2 text-muted">{{ relTime(m.at) }}</td>
          <td class="px-3 py-2">
            <PBadge :tone="TONE[m.status]" dot>{{ t(`logic.queue.msg.${m.status}`) }}</PBadge>
          </td>
          <td class="px-3 py-2 font-mono text-xs">{{ m.attempts }}</td>
          <td class="px-3 py-2">
            <div class="truncate font-mono text-xs text-fg-2" :title="JSON.stringify(m.body, null, 2)">
              {{ JSON.stringify(m.body) }}
            </div>
            <div v-if="m.error" class="truncate text-xs text-danger">{{ m.error }}</div>
          </td>
          <td class="px-2 py-2">
            <div class="flex justify-end gap-1">
              <PButton
                v-if="m.status === 'dead' || m.status === 'retrying'"
                size="xs"
                :icon="RotateCcw"
                @click="emit('replay', m.id)"
                >{{ t('logic.queue.replay') }}</PButton
              >
              <PButton
                size="xs"
                variant="ghost"
                square
                :icon="Trash2"
                :label="t('logic.queue.deleteMsg')"
                :title="t('logic.queue.deleteMsg')"
                @click="emit('remove', m.id)"
              />
            </div>
          </td>
        </tr>
        <tr v-if="!messages.length">
          <td colspan="6" class="px-3 py-8 text-center text-sm text-faint">
            {{ t('logic.queue.noMessages') }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
