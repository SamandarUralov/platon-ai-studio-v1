<script setup lang="ts">
/** Message queue workspace: Flow · Messages · Settings (requirements §3.3 Message queues). */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Inbox, ListChecks, Send, Settings2, Workflow } from 'lucide-vue-next'
import type { Queue, TypedField } from '@platon/definition'
import { VALUE_TYPES } from '@platon/definition'
import { cn, PBadge, PButton, PIcon, PTabs, toast, type TabItem } from '@platon/ui'
import SaveBar from '@/components/common/SaveBar.vue'
import { useShortcuts } from '@/composables/useShortcuts'
import { useProjectId } from '@/composables/useProject'
import { errorMessage } from '@/services/http'
import { useLogicItem } from '../../composables/useLogicItem'
import { useLogicEditor, type QueueTab } from '../../store'
import { useLogicStats, useQueueActions, useQueueMessages } from '../../api'
import { itemStatus } from '../../lib/status'
import ToneTile from '../ToneTile.vue'
import FieldSchemaEditor from '../FieldSchemaEditor.vue'
import QueueFlow from './QueueFlow.vue'
import QueueMessages from './QueueMessages.vue'
import QueueDelivery from './QueueDelivery.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const ed = useLogicEditor()
const pid = useProjectId()
const L = useLogicItem<Queue>('queues', () => props.id)
const stats = useLogicStats(pid)
const msgs = useQueueMessages(pid, () => props.id)
const act = useQueueActions(pid, () => props.id)

const q = computed(() => L.item.value)
const messages = computed(() => msgs.data.value ?? [])
const status = computed(() =>
  q.value ? itemStatus('queues', q.value, L.problems.value, stats.data.value) : null,
)
const waiting = computed(
  () => messages.value.filter((m) => m.status === 'waiting' || m.status === 'retrying').length,
)
const tab = computed({ get: () => ed.queueTab, set: (v: QueueTab) => (ed.queueTab = v) })
const tabs = computed<TabItem<QueueTab>[]>(() => [
  { value: 'flow', label: t('logic.queue.tabs.flow'), icon: Workflow },
  {
    value: 'messages',
    label: t('logic.queue.tabs.messages'),
    icon: ListChecks,
    count: messages.value.length || undefined,
  },
  { value: 'settings', label: t('logic.queue.tabs.settings'), icon: Settings2 },
])
const BROKERS = [
  { value: 'rabbitmq' as const, label: 'RabbitMQ', sub: t('logic.queue.rabbitSub') },
  { value: 'kafka' as const, label: 'Kafka', sub: t('logic.queue.kafkaSub') },
]

function edit(fn: (x: Queue) => Queue) {
  L.edit(fn)
}

async function run<T>(p: Promise<T>, ok: (r: T) => string) {
  try {
    toast(ok(await p), { tone: 'ok' })
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  }
}
const sendTest = () => run(act.send.mutateAsync(), (m) => t('logic.queue.sent', { id: m.id }))
const replayAll = () => run(act.replayDead.mutateAsync(), (r) => t('logic.queue.replayed', r.replayed))
const replay = (id: string) => run(act.replay.mutateAsync(id), () => t('logic.queue.replayedOne'))
const removeMsg = (id: string) => run(act.remove.mutateAsync(id), () => t('logic.queue.deleted'))

useShortcuts([{ keys: 'mod+s', run: () => (L.dirty.value ? L.save() : false), inInputs: true }])
</script>

<template>
  <div v-if="q" class="flex min-h-0 flex-1 flex-col">
    <header class="shrink-0 border-b border-line-2 bg-surface px-6 pt-4">
      <div class="flex items-start gap-3.5">
        <ToneTile icon="inbox" tone="purple" size="lg" />
        <div class="min-w-0 flex-1">
          <h1 class="m-0 truncate font-mono text-[22px] font-extrabold leading-8 tracking-tight">
            {{ q.name }}
          </h1>
          <div class="truncate text-sm text-muted">
            {{ t('logic.queue.sub', q.consumers.length) }} · {{ t('logic.queue.waiting', { n: waiting }) }} ·
            <span class="font-mono">logic.queues.{{ id }}</span>
          </div>
          <p v-if="q.description" class="mt-0.5 line-clamp-1 text-sm text-fg-2">{{ q.description }}</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <SaveBar :dirty="L.dirty.value" @save="L.save" @discard="L.discard" />
          <PBadge v-if="status" :tone="status.tone">{{
            t(`logic.status.${status.key}`, { n: status.count ?? 0 })
          }}</PBadge>
          <PButton :icon="Send" :loading="act.send.isPending.value" @click="sendTest">{{
            t('logic.queue.sendTest')
          }}</PButton>
        </div>
      </div>
      <PTabs v-model="tab" :items="tabs" class="mt-3 border-b-0">
        <template #end
          ><span class="text-xs text-faint">{{ t('logic.queue.envNote') }}</span></template
        >
      </PTabs>
    </header>

    <div class="min-h-0 flex-1 overflow-auto scroll-thin">
      <div class="mx-auto max-w-[980px] px-6 py-5">
        <QueueFlow
          v-if="tab === 'flow'"
          :queue="q"
          :messages="messages"
          :replaying="act.replayDead.isPending.value"
          @edit="edit"
          @replay-all="replayAll"
        />
        <QueueMessages
          v-else-if="tab === 'messages'"
          :messages="messages"
          :loading="msgs.isLoading.value"
          @replay="replay"
          @remove="removeMsg"
        />
        <div v-else class="grid gap-5 lg:grid-cols-2">
          <section class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div class="text-md font-bold">{{ t('logic.queue.broker') }}</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="b in BROKERS"
                :key="b.value"
                type="button"
                :class="
                  cn(
                    'flex items-start gap-2 rounded-lg border p-2.5 text-left',
                    (q.settings.broker ?? 'rabbitmq') === b.value
                      ? 'border-primary bg-primary-tint'
                      : 'border-line hover:bg-hover',
                  )
                "
                @click="edit((x) => ({ ...x, settings: { ...x.settings, broker: b.value } }))"
              >
                <PIcon
                  :name="b.value === 'kafka' ? 'waves' : 'rabbit'"
                  :size="15"
                  class="mt-0.5 text-muted"
                />
                <span
                  ><span class="block text-sm font-bold">{{ b.label }}</span
                  ><span class="block text-2xs text-muted">{{ b.sub }}</span></span
                >
              </button>
            </div>
            <div class="text-md font-bold">{{ t('logic.queue.fields') }}</div>
            <FieldSchemaEditor
              :fields="q.fields"
              :types="VALUE_TYPES"
              @update="(f: TypedField[]) => edit((x) => ({ ...x, fields: f }))"
            />
          </section>
          <section class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div class="text-md font-bold">{{ t('logic.queue.delivery') }}</div>
            <QueueDelivery :queue="q" @edit="edit" />
          </section>
          <p class="flex items-start gap-2 text-xs text-faint lg:col-span-2">
            <Inbox :size="13" class="mt-0.5 shrink-0" />{{ t('logic.queue.settingsNote') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
