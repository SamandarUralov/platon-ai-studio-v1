<script setup lang="ts">
/** Generated DDL (per SQL dialect), Mongo JSON schema or Redis key spec — read-only Monaco. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalStorage } from '@vueuse/core'
import { Copy, FileCode2, Terminal } from 'lucide-vue-next'
import { PCheckbox, PCodeEditor, toast } from '@platon/ui'
import { ENGINES, type DbConnection, type Table } from '@platon/definition'
import { generateDdl, isSqlEngine, SQL_DIALECTS, type SqlDialect } from '../lib/ddl'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ table: Table; conn: DbConnection }>()
const emit = defineEmits<{ openSql: [text: string] }>()
const { t } = useI18n()
const m = useData()
const extras = useLocalStorage('platon.data.ddlExtras', true)
const dialect = ref<SqlDialect>(isSqlEngine(props.conn.engine) ? props.conn.engine : 'postgres')
watch(
  () => props.conn.engine,
  (e) => isSqlEngine(e) && (dialect.value = e),
)

const ddl = computed(() =>
  generateDdl(
    props.table,
    {
      connection: props.conn,
      tables: m.tables.value,
      workflowStates: m.workflowStates,
      extras: extras.value,
    },
    { dialect: dialect.value, appSlug: m.appSlug.value },
  ),
)
const lines = computed(() => ddl.value.text.split('\n').length)

function copy() {
  void navigator.clipboard?.writeText(ddl.value.text)
  toast(t('data.ddl.copied'))
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="overflow-hidden rounded-xl bg-code-bg">
      <div class="flex flex-wrap items-center gap-2 border-b border-code-line py-2 pl-3.5 pr-2.5">
        <FileCode2 :size="14" class="text-code-muted" />
        <span class="text-sm font-semibold text-code-fg">{{ ddl.file }}</span>
        <div
          v-if="isSqlEngine(conn.engine)"
          role="radiogroup"
          class="ml-2 flex gap-0.5 rounded-[7px] bg-code-bg-2 p-[3px]"
        >
          <button
            v-for="d in SQL_DIALECTS"
            :key="d"
            type="button"
            role="radio"
            :aria-checked="dialect === d"
            class="h-6 rounded-[5px] px-2.5 text-xs font-semibold"
            :class="dialect === d ? 'bg-code-sel text-code-fg' : 'text-code-muted hover:text-code-fg'"
            @click="dialect = d"
          >
            {{ ENGINES[d].label }}
          </button>
        </div>
        <label
          v-if="conn.engine !== 'redis'"
          class="ml-auto flex items-center gap-1.5 text-xs text-code-muted"
        >
          <PCheckbox v-model="extras" />{{ t('data.ddl.extras') }}
        </label>
        <button
          type="button"
          :class="[
            'flex h-7 items-center gap-1.5 rounded-[7px] border border-code-line px-2.5 text-xs font-semibold text-code-fg hover:border-primary',
            conn.engine === 'redis' ? 'ml-auto' : '',
          ]"
          @click="copy"
        >
          <Copy :size="12" />{{ t('data.ddl.copy') }}
        </button>
        <button
          v-if="isSqlEngine(conn.engine)"
          type="button"
          class="flex h-7 items-center gap-1.5 rounded-[7px] border border-code-line px-2.5 text-xs font-semibold text-code-fg hover:border-primary"
          @click="emit('openSql', ddl.text)"
        >
          <Terminal :size="12" />{{ t('data.ddl.openSql') }}
        </button>
      </div>
      <div :style="{ height: `${Math.min(640, Math.max(220, lines * 20 + 24))}px` }">
        <PCodeEditor :model-value="ddl.text" :language="ddl.language" readonly />
      </div>
    </div>
    <p class="text-xs text-muted">{{ t('data.ddl.note') }}</p>
  </div>
</template>
