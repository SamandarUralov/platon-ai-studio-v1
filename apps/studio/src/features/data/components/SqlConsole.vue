<script setup lang="ts">
/** SQL console on Development (requirements §3.4). ⌘↵ runs; snippets prefill; results show time and rows. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@tanstack/vue-query'
import { CircleAlert, CircleCheck, Info, Play, Terminal, Timer } from 'lucide-vue-next'
import { PBadge, PButton, PCodeEditor, PTooltip } from '@platon/ui'
import { ENGINES, type DbConnection, type SqlResponse, type Table } from '@platon/definition'
import { errorMessage } from '@/services/http'
import { kbd, useShortcuts } from '@/composables/useShortcuts'
import { dataApi } from '../api'
import { columnName, tableName } from '../lib/ddl'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ conn: DbConnection; table: Table }>()
const sql = defineModel<string>({ default: '' })
const { t } = useI18n()
const m = useData()

const name = computed(() => tableName(props.table))
const firstCol = computed(
  () =>
    props.table.fields.find((f) => f.type !== 'auto_number' && f.type !== 'link') ?? props.table.fields[0],
)
const groupCol = computed(
  () =>
    props.table.fields.find((f) => f.type === 'single_select' || f.type === 'workflow_state') ??
    props.table.fields.find((f) => f.type === 'link') ??
    firstCol.value,
)
const snippets = computed(() => {
  const c = firstCol.value ? columnName(firstCol.value) : 'id'
  const g = groupCol.value ? columnName(groupCol.value) : 'id'
  return [
    { label: t('data.sql.snip.first'), sql: `SELECT *\nFROM ${name.value}\nLIMIT 20;` },
    { label: t('data.sql.snip.count'), sql: `SELECT COUNT(*) AS total\nFROM ${name.value};` },
    {
      label: t('data.sql.snip.filter'),
      sql: `SELECT id, ${c}\nFROM ${name.value}\nWHERE ${c} LIKE '%a%'\nORDER BY ${c}\nLIMIT 50;`,
    },
    {
      label: t('data.sql.snip.group'),
      sql: `SELECT ${g}, COUNT(*) AS n\nFROM ${name.value}\nGROUP BY ${g}\nORDER BY n DESC;`,
    },
  ]
})
// The host keeps one query per table; start an empty one with a snippet.
watch(
  () => props.table.id,
  () => {
    if (!sql.value.trim()) sql.value = snippets.value[0]!.sql
  },
  { immediate: true },
)

const result = ref<SqlResponse | null>(null)
const error = ref<string | null>(null)
const run = useMutation({
  mutationFn: () =>
    dataApi.sql(m.pid.value, { sql: sql.value, connectionId: props.conn.id, env: 'development' }),
  onMutate: () => (error.value = null),
  onSuccess: (r) => (result.value = r),
  onError: (e) => {
    result.value = null
    error.value = errorMessage(e)
  },
})
function exec() {
  if (sql.value.trim() && !run.isPending.value) run.mutate()
}
useShortcuts([{ keys: 'mod+enter', inInputs: true, run: () => exec() }])

const cell = (v: unknown) =>
  v === null || v === undefined || v === '' ? null : typeof v === 'object' ? JSON.stringify(v) : String(v)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-if="!ENGINES[conn.engine].sql"
      class="flex gap-2 rounded-[10px] border border-warn/30 bg-warn-bg px-3 py-2.5 text-sm text-warn"
    >
      <Info :size="14" class="mt-px shrink-0" />{{
        t('data.sql.noSql', { engine: ENGINES[conn.engine].label })
      }}
    </div>
    <div class="overflow-hidden rounded-xl bg-code-bg">
      <div class="flex flex-wrap items-center gap-2 border-b border-code-line py-2 pl-3.5 pr-2.5">
        <Terminal :size="14" class="text-code-muted" />
        <span class="text-sm font-semibold text-code-fg"
          >{{ conn.name }} · {{ ENGINES[conn.engine].label }}</span
        >
        <PTooltip :text="t('data.sql.devOnly')">
          <PBadge tone="ok" dot size="xs">{{ t('data.envs.development') }}</PBadge>
        </PTooltip>
        <div class="ml-auto flex flex-wrap gap-1.5">
          <button
            v-for="s in snippets"
            :key="s.label"
            type="button"
            class="h-[26px] rounded-md border border-code-line px-2.5 text-xs font-semibold text-code-muted hover:border-primary hover:text-code-fg"
            @click="sql = s.sql"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
      <div class="h-[200px]">
        <PCodeEditor v-model="sql" language="sql" :path="`sql/${conn.id}.sql`" />
      </div>
      <div class="flex items-center gap-2 border-t border-code-line py-2 pl-3.5 pr-2.5">
        <span class="text-xs text-code-muted">{{ t('data.sql.hint', { kbd: kbd('mod+enter') }) }}</span>
        <PButton
          variant="primary"
          size="xs"
          :icon="Play"
          class="ml-auto"
          :loading="run.isPending.value"
          @click="exec"
          >{{ t('data.sql.run') }}</PButton
        >
      </div>
    </div>

    <div
      v-if="error"
      role="alert"
      class="flex gap-2 rounded-[10px] border border-danger/30 bg-danger-bg px-3 py-2.5 font-mono text-sm leading-snug text-danger"
    >
      <CircleAlert :size="14" class="mt-0.5 shrink-0" />{{ error }}
    </div>
    <template v-else-if="result">
      <div class="flex items-center gap-3 text-sm">
        <span class="inline-flex items-center gap-1.5 font-semibold text-ok"
          ><CircleCheck :size="14" />{{ result.message ?? t('data.sql.rows', { n: result.rowCount }) }}</span
        >
        <span class="inline-flex items-center gap-1 text-muted"
          ><Timer :size="13" />{{ t('data.sql.ms', { n: result.elapsedMs }) }}</span
        >
      </div>
      <div
        v-if="result.columns.length"
        class="scroll-thin max-h-[380px] overflow-auto rounded-xl border border-line-2 bg-surface"
      >
        <table class="w-full border-collapse font-mono text-sm">
          <thead class="sticky top-0 bg-subtle-2">
            <tr>
              <th
                v-for="c in result.columns"
                :key="c"
                class="whitespace-nowrap border-b border-line-soft px-3.5 py-2 text-left text-xs font-semibold text-muted"
              >
                {{ c }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in result.rows" :key="i" class="hover:bg-hover">
              <td
                v-for="(v, j) in r"
                :key="j"
                class="max-w-[320px] truncate whitespace-nowrap border-b border-line-faint px-3.5 py-1.5"
              >
                <span v-if="cell(v) === null" class="text-faint-2">{{ t('data.sql.null') }}</span>
                <template v-else>{{ cell(v) }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <p v-else class="text-sm text-faint">{{ t('data.sql.empty') }}</p>
  </div>
</template>
