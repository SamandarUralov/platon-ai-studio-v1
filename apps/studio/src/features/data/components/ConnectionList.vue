<script setup lang="ts">
/** Left panel: every database connection with its tables / collections / key sets. */
import { useI18n } from 'vue-i18n'
import { Database, Layers, Plus } from 'lucide-vue-next'
import { PButton, PEmptyState, PIcon, PTooltip } from '@platon/ui'
import { ENGINES, type DbConnection } from '@platon/definition'
import SectionLabel from '@/components/common/SectionLabel.vue'
import EngineLogo from './EngineLogo.vue'
import { useData } from '../composables/useDataModel'

defineProps<{ connId?: string; tableId?: string }>()
const emit = defineEmits<{
  openConn: [id: string]
  openTable: [connId: string, tableId: string]
  newDb: []
  newTable: [connId: string]
}>()
const { t } = useI18n()
const m = useData()

const credTone = (c: DbConnection) => (c.credentials?.development ? 'bg-ok-dot' : 'bg-warn-dot')
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <SectionLabel :label="t('data.databases')" :count="m.connections.value.length" class="mt-2">
      <PButton
        variant="ghost"
        size="xs"
        square
        :icon="Plus"
        :label="t('data.newDatabase')"
        @click="emit('newDb')"
      />
    </SectionLabel>
    <nav class="scroll-thin min-h-0 flex-1 overflow-auto px-2 pb-12" :aria-label="t('data.databases')">
      <PEmptyState
        v-if="!m.connections.value.length"
        :icon="Database"
        :title="t('data.noDatabases')"
        :description="t('data.noDatabasesHint')"
      >
        <PButton variant="primary" :icon="Plus" @click="emit('newDb')">{{ t('data.newDatabase') }}</PButton>
      </PEmptyState>
      <div v-for="c in m.connections.value" :key="c.id" class="mb-2.5">
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left"
          :class="connId === c.id && !tableId ? 'bg-primary-tint' : 'hover:bg-hover'"
          @click="emit('openConn', c.id)"
        >
          <EngineLogo :engine="c.engine" />
          <span class="min-w-0 flex-1">
            <span
              class="block truncate text-base font-bold"
              :class="connId === c.id && !tableId ? 'text-primary-strong' : ''"
              >{{ c.name }}</span
            >
            <span class="block truncate text-2xs text-faint"
              >{{ ENGINES[c.engine].label }} · {{ t(`data.roles.${c.role}`) }}</span
            >
          </span>
          <PTooltip :text="c.credentials?.development ? t('data.conn.set') : t('data.conn.notSet')">
            <span class="size-[7px] shrink-0 rounded-full" :class="credTone(c)" />
          </PTooltip>
        </button>
        <div class="ml-[21px] mt-0.5 flex flex-col gap-px border-l border-line-soft pl-2">
          <button
            v-for="tb in m.tablesOf(c.id)"
            :key="tb.id"
            type="button"
            class="flex items-center gap-2 rounded-[7px] px-2 py-[5px] text-left"
            :class="tableId === tb.id ? 'bg-primary-tint text-primary-strong' : 'text-fg hover:bg-hover'"
            :aria-current="tableId === tb.id ? 'page' : undefined"
            @click="emit('openTable', c.id, tb.id)"
          >
            <PIcon :name="tb.icon" :size="14" :class="tableId === tb.id ? '' : 'text-muted'" />
            <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ tb.name }}</span>
            <span class="text-2xs tabular-nums text-faint">{{ m.count(tb.id) ?? '' }}</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-2 rounded-[7px] px-2 py-[5px] text-left text-sm font-semibold text-muted hover:bg-hover hover:text-primary-strong"
            @click="emit('newTable', c.id)"
          >
            <Plus :size="13" />{{ t('data.newUnit', { unit: ENGINES[c.engine].unit }) }}
          </button>
        </div>
      </div>

      <div
        v-if="m.connections.value.length"
        class="mx-1 mt-5 rounded-xl bg-subtle p-3.5 text-sm leading-relaxed text-fg-2"
      >
        <div class="mb-1.5 font-bold text-fg">{{ t('data.structureVsRecords') }}</div>
        <div class="mb-1.5 flex gap-2">
          <Layers :size="14" class="mt-0.5 shrink-0 text-primary" /><span>{{ t('data.structureNote') }}</span>
        </div>
        <div class="flex gap-2">
          <Database :size="14" class="mt-0.5 shrink-0 text-teal" /><span>{{ t('data.recordsNote') }}</span>
        </div>
      </div>
    </nav>
  </div>
</template>
