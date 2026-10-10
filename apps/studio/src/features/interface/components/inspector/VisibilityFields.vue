<script setup lang="ts">
/** Who can see a block (roles) and an optional condition on a record field or the viewer. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, ShieldCheck, X } from 'lucide-vue-next'
import { PCheckbox, PField, PSelect } from '@platon/ui'
import type { Block, Page, VisibilityCondition } from '@platon/definition'
import { isRecordCondition } from '@platon/renderer'
import { useDefinitionStore } from '@/stores/definition'
import { useInterfaceEdits } from '../../composables/useInterfaceEdits'
import { visibilitySummary } from './visibility'

const props = defineProps<{ page: Page; block: Block }>()
const { t } = useI18n()
const def = useDefinitionStore()
const edits = useInterfaceEdits()
const roles = computed(() => def.definition?.roles ?? [])
const v = computed(() => props.block.visibility)

type Who = 'everyone' | 'roles' | 'nobody'
const who = computed<Who>(() => (!v.value?.roles ? 'everyone' : v.value.roles.length ? 'roles' : 'nobody'))
const whoOptions = computed(() =>
  (['everyone', 'roles', 'nobody'] as const).map((x) => ({ value: x, label: t(`interface.vis.who.${x}`) })),
)

function setRoles(r: string[] | undefined, text: string) {
  edits.blockField(props.page, props.block, ['visibility', 'roles'], r, text)
}
function setWho(w: Who | undefined) {
  if (w === 'everyone') setRoles(undefined, t('interface.vis.changed.everyone'))
  else if (w === 'nobody') setRoles([], t('interface.vis.changed.nobody'))
  else if (w === 'roles')
    setRoles(
      roles.value.slice(0, 1).map((r) => r.id),
      t('interface.vis.changed.roles'),
    )
}
function toggleRole(id: string, on: boolean) {
  const cur = v.value?.roles ?? []
  setRoles(
    roles.value.map((r) => r.id).filter((x) => (x === id ? on : cur.includes(x))),
    t('interface.vis.changed.roles'),
  )
}

/** Fields a condition can use: the block's table fields, then viewer facts. */
const fields = computed(() => {
  const src = (props.block.props as { source?: string }).source
  const tbl = def.definition?.data.tables.find((x) => x.id === src)
  const wf = (key: string) => {
    const f = tbl?.fields.find((x) => x.key === key)
    if (f?.options) return f.options
    if (f?.type === 'workflow_state')
      return def.definition?.workflows.find((w) => w.id === f.workflow)?.states.map((s) => s.name)
    return undefined
  }
  return [
    ...(tbl?.fields.map((f) => ({ value: f.key, label: `${tbl.name} · ${f.name}`, values: wf(f.key) })) ??
      []),
    { value: 'region', label: t('interface.vis.f.region'), values: ['North', 'Central', 'South'] },
    { value: 'lang', label: t('interface.vis.f.lang'), values: def.definition?.settings.languages },
  ]
})
const ops = computed(() =>
  (['eq', 'neq', 'in', 'empty', 'not_empty'] as const).map((o) => ({
    value: o,
    label: t(`interface.vis.op.${o}`),
  })),
)
const cond = computed(() => v.value?.condition)
const condField = computed(() => fields.value.find((f) => f.value === cond.value?.field))

function setCond(c: VisibilityCondition | undefined) {
  edits.blockField(
    props.page,
    props.block,
    ['visibility', 'condition'],
    c,
    c ? t('interface.vis.changed.cond') : t('interface.vis.changed.noCond'),
  )
}
function patchCond(p: Partial<VisibilityCondition>) {
  if (cond.value) setCond({ ...cond.value, ...p })
}
function addCond() {
  const f = fields.value[0]!
  setCond({ field: f.value, op: 'eq', value: f.values?.[0] ?? '' })
}
const summary = computed(() => (def.definition ? visibilitySummary(def.definition, props.block, t) : ''))
</script>

<template>
  <div class="space-y-3.5">
    <PField :label="t('interface.vis.whoLabel')">
      <PSelect :model-value="who" :options="whoOptions" @update:model-value="setWho" />
    </PField>
    <div v-if="who === 'roles'" class="grid grid-cols-2 gap-1.5">
      <PCheckbox
        v-for="r in roles"
        :key="r.id"
        :label="r.name"
        :model-value="v?.roles?.includes(r.id) ?? false"
        @update:model-value="toggleRole(r.id, $event === true)"
      />
    </div>
    <PField :label="t('interface.vis.condition')">
      <button
        v-if="!cond"
        type="button"
        class="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line text-sm text-fg-2 hover:bg-hover"
        @click="addCond"
      >
        <Plus :size="14" />{{ t('interface.vis.addCondition') }}
      </button>
      <div v-else class="space-y-2 rounded-lg border border-line bg-subtle-2 p-2.5">
        <div class="flex items-center">
          <span class="text-xs font-semibold text-muted">{{ t('interface.vis.onlyWhen') }}</span>
          <button
            type="button"
            class="ml-auto grid size-6 place-items-center rounded-md text-muted hover:bg-hover"
            :aria-label="t('interface.vis.removeCondition')"
            @click="setCond(undefined)"
          >
            <X :size="13" />
          </button>
        </div>
        <PSelect
          size="sm"
          :model-value="cond.field"
          :options="fields"
          @update:model-value="
            (f) => f && patchCond({ field: f, value: fields.find((x) => x.value === f)?.values?.[0] ?? '' })
          "
        />
        <div class="grid grid-cols-2 gap-2">
          <PSelect
            size="sm"
            :model-value="cond.op"
            :options="ops"
            @update:model-value="(o) => o && patchCond({ op: o })"
          />
          <template v-if="cond.op !== 'empty' && cond.op !== 'not_empty'">
            <PSelect
              v-if="condField?.values?.length && cond.op !== 'in'"
              size="sm"
              :model-value="String(cond.value ?? '')"
              :options="condField.values.map((x) => ({ value: x, label: x }))"
              @update:model-value="(x) => patchCond({ value: x })"
            />
            <input
              v-else
              :value="String(cond.value ?? '')"
              class="h-[30px] min-w-0 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-primary"
              :aria-label="t('interface.vis.value')"
              @change="patchCond({ value: ($event.target as HTMLInputElement).value })"
            />
          </template>
        </div>
        <p class="text-xs text-faint">
          {{
            def.definition && isRecordCondition(def.definition, block)
              ? t('interface.vis.recordHint')
              : t('interface.vis.viewerHint')
          }}
        </p>
      </div>
    </PField>
    <div class="flex items-start gap-2 rounded-lg bg-primary-tint px-3 py-2.5 text-sm text-primary-strong">
      <ShieldCheck :size="15" class="mt-0.5 shrink-0" />{{ summary }}
    </div>
  </div>
</template>
