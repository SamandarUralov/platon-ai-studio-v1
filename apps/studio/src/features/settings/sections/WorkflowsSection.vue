<script setup lang="ts">
/**
 * Workflows: state machine editor (states with tone/final, ordered; transitions from → to with a requirement
 * label and the roles allowed to make them). States are addressed by id; transitions have no id, so the
 * transitions list is replaced as a whole (one upserted change per workflow).
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowRight, ArrowUp, Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-vue-next'
import {
  PBadge,
  PButton,
  PCheckbox,
  PDialog,
  PEmptyState,
  PField,
  PInput,
  PSegmented,
  PSelect,
  cn,
  toast,
  toneClasses,
  type SegmentOption,
  type SelectOption,
  type Tone,
} from '@platon/ui'
import { snake, uniqueName, type Workflow } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import SettingsCard from '../components/SettingsCard.vue'
import WorkflowDiagram from '../components/WorkflowDiagram.vue'
import { STATE_TONES } from '../catalog'

type State = Workflow['states'][number]
type Transition = Workflow['transitions'][number]

const { t } = useI18n()
const def = useDefinitionStore()
/** Definition ids must start with a letter. */
const toId = (name: string, fallback: string) => {
  const s = snake(name)
  return !s ? fallback : /^[a-z]/.test(s) ? s : `${fallback}_${s}`
}

const workflows = computed(() => def.definition!.workflows)
const selectedId = ref<string>('')
watch(
  workflows,
  (list) => {
    if (!list.some((w) => w.id === selectedId.value)) selectedId.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
const wf = computed(() => workflows.value.find((w) => w.id === selectedId.value))
const wfOptions = computed<SegmentOption<string>[]>(() =>
  workflows.value.map((w) => ({ value: w.id, label: w.name })),
)
const base = computed(() => `/workflows/${selectedId.value}`)
const tableName = (id: string) => def.definition!.data.tables.find((x) => x.id === id)?.name ?? id
const roles = computed(() => def.definition!.roles)
const toneOptions = computed<SelectOption<string>[]>(() =>
  STATE_TONES.map((tn) => ({ value: tn, label: t(`settings.workflows.tones.${tn}`) })),
)
const stateOptions = computed<SelectOption<string>[]>(() =>
  (wf.value?.states ?? []).map((s) => ({ value: s.id, label: s.name })),
)
const stateName = (id: string) => wf.value?.states.find((s) => s.id === id)?.name ?? id
const toneOf = (id: string): Tone => {
  const tn = wf.value?.states.find((s) => s.id === id)?.tone
  return tn && tn in toneClasses ? (tn as Tone) : 'neutral'
}

// ── States ───────────────────────────────────────────────────────────────────────────
const names = ref<Record<string, string>>({})
watch(
  () => wf.value?.states,
  (s) => (names.value = Object.fromEntries((s ?? []).map((x) => [x.id, x.name]))),
  { immediate: true },
)

function rename(s: State) {
  const v = names.value[s.id]?.trim()
  if (!v || v === s.name) {
    names.value[s.id] = s.name
    return
  }
  def.apply({
    key: `workflows.${selectedId.value}.states.${s.id}.name`,
    area: 'Workflow',
    text: `Renamed state “${s.name}” to “${v}”`,
    ops: [{ op: 'replace', path: `${base.value}/states/${s.id}/name`, value: v }],
  })
}
function setTone(s: State, tone: string) {
  def.apply({
    key: `workflows.${selectedId.value}.states.${s.id}.tone`,
    area: 'Workflow',
    text: `Changed “${s.name}” colour`,
    ops: [{ op: s.tone ? 'replace' : 'add', path: `${base.value}/states/${s.id}/tone`, value: tone }],
  })
}
function setFinal(s: State, final: boolean) {
  def.apply({
    key: `workflows.${selectedId.value}.states.${s.id}.final`,
    area: 'Workflow',
    text: final ? `Marked “${s.name}” as a final state` : `“${s.name}” is no longer final`,
    ops: [
      {
        op: s.final === undefined ? 'add' : 'replace',
        path: `${base.value}/states/${s.id}/final`,
        value: final,
      },
    ],
  })
}
function move(s: State, dir: -1 | 1) {
  const list = [...wf.value!.states]
  const i = list.findIndex((x) => x.id === s.id)
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
  def.apply({
    key: `workflows.${selectedId.value}.states.order`,
    area: 'Workflow',
    text: `Reordered ${wf.value!.name} states`,
    ops: [{ op: 'replace', path: `${base.value}/states`, value: list }],
  })
}

const newState = ref('')
function addState() {
  const name = newState.value.trim()
  if (!name || !wf.value) return
  const id = uniqueName(
    toId(name, 'state'),
    wf.value.states.map((s) => s.id),
  )
  // New states go before the first final state, so "Done" stays last.
  const finalIdx = wf.value.states.findIndex((s) => s.final)
  const pos = finalIdx < 0 ? '-' : String(finalIdx)
  def.apply({
    key: `workflows.${selectedId.value}.states.${id}`,
    area: 'Workflow',
    text: `Added “${name}” state to ${wf.value.name}`,
    ops: [{ op: 'add', path: `${base.value}/states/${pos}`, value: { id, name, tone: 'neutral' } }],
  })
  newState.value = ''
}

const deleting = ref<State | null>(null)
const deleteOpen = computed({ get: () => !!deleting.value, set: (v) => !v && (deleting.value = null) })
const deletingUses = computed(() =>
  deleting.value
    ? (wf.value?.transitions ?? []).filter(
        (x) => x.from === deleting.value!.id || x.to === deleting.value!.id,
      ).length
    : 0,
)
function removeState() {
  const s = deleting.value
  if (!s || !wf.value) return
  const kept = wf.value.transitions.filter((x) => x.from !== s.id && x.to !== s.id)
  def.apply({
    key: `workflows.${selectedId.value}.states.${s.id}`,
    area: 'Workflow',
    text: `Removed “${s.name}” state from ${wf.value.name}`,
    ops: [
      { op: 'replace', path: `${base.value}/transitions`, value: kept },
      { op: 'remove', path: `${base.value}/states/${s.id}` },
    ],
  })
  deleting.value = null
}

// ── Transitions ──────────────────────────────────────────────────────────────────────
const labels = ref<string[]>([])
watch(
  () => wf.value?.transitions,
  (tr) => (labels.value = (tr ?? []).map((x) => x.requires ?? '')),
  { immediate: true },
)

function writeTransitions(list: Transition[], text: string) {
  def.apply({
    key: `workflows.${selectedId.value}.transitions`,
    area: 'Workflow',
    text,
    ops: [{ op: 'replace', path: `${base.value}/transitions`, value: list }],
  })
}
function patchTransition(i: number, patch: Partial<Transition>, text: string) {
  const list = wf.value!.transitions.map((x, j) => {
    if (j !== i) return x
    const next = { ...x, ...patch }
    if (!next.requires) delete next.requires
    return next
  })
  writeTransitions(list, text)
}
function saveLabel(i: number) {
  const tr = wf.value!.transitions[i]!
  const v = labels.value[i]?.trim() ?? ''
  if (v === (tr.requires ?? '')) return
  patchTransition(
    i,
    { requires: v },
    `Move ${stateName(tr.from)} → ${stateName(tr.to)} now requires “${v || 'nothing'}”`,
  )
}
function toggleRole(i: number, role: string) {
  const tr = wf.value!.transitions[i]!
  const on = tr.roles.includes(role)
  const roleName = roles.value.find((r) => r.id === role)?.name ?? role
  patchTransition(
    i,
    { roles: on ? tr.roles.filter((r) => r !== role) : [...tr.roles, role] },
    `${on ? 'Removed' : 'Allowed'} ${roleName} for ${stateName(tr.from)} → ${stateName(tr.to)}`,
  )
}
function setEnd(i: number, end: 'from' | 'to', v: string | undefined) {
  if (!v) return
  const tr = wf.value!.transitions[i]!
  const next = { ...tr, [end]: v }
  if (next.from === next.to) return toast(t('settings.workflows.sameState'), { tone: 'warn' })
  if (wf.value!.transitions.some((x, j) => j !== i && x.from === next.from && x.to === next.to))
    return toast(t('settings.workflows.duplicate'), { tone: 'warn' })
  patchTransition(i, { [end]: v }, `Changed move to ${stateName(next.from)} → ${stateName(next.to)}`)
}
function addTransition() {
  const s = wf.value!.states
  if (s.length < 2) return
  const taken = new Set(wf.value!.transitions.map((x) => `${x.from}>${x.to}`))
  let pair: [string, string] | null = null
  for (const a of s)
    for (const b of s) if (!pair && a.id !== b.id && !taken.has(`${a.id}>${b.id}`)) pair = [a.id, b.id]
  if (!pair) return toast(t('settings.workflows.allConnected'))
  writeTransitions(
    [
      ...wf.value!.transitions,
      { from: pair[0], to: pair[1], roles: roles.value.slice(0, 1).map((r) => r.id) },
    ],
    `Added move ${stateName(pair[0])} → ${stateName(pair[1])}`,
  )
}
function removeTransition(i: number) {
  const tr = wf.value!.transitions[i]!
  writeTransitions(
    wf.value!.transitions.filter((_, j) => j !== i),
    `Removed move ${stateName(tr.from)} → ${stateName(tr.to)}`,
  )
}

// ── New workflow ─────────────────────────────────────────────────────────────────────
const createOpen = ref(false)
const newName = ref('')
const newTable = ref<string>('')
const tableOptions = computed<SelectOption<string>[]>(() =>
  def.definition!.data.tables.map((x) => ({ value: x.id, label: x.name })),
)
watch(createOpen, (o) => {
  if (!o) return
  newName.value = ''
  newTable.value = tableOptions.value[0]?.value ?? ''
})
function createWorkflow() {
  const name = newName.value.trim()
  if (!name || !newTable.value) return
  const id = uniqueName(
    toId(name, 'workflow'),
    workflows.value.map((w) => w.id),
  )
  const all = roles.value.map((r) => r.id)
  const value: Workflow = {
    id,
    name,
    table: newTable.value,
    states: [
      { id: 'new', name: 'New', tone: 'neutral' },
      { id: 'in_progress', name: 'In progress', tone: 'warn' },
      { id: 'done', name: 'Done', tone: 'ok', final: true },
    ],
    transitions: [
      { from: 'new', to: 'in_progress', roles: all },
      { from: 'in_progress', to: 'done', roles: all },
    ],
  }
  def.apply({
    key: `workflows.${id}`,
    area: 'Workflow',
    text: `Added ${name} workflow on ${tableName(newTable.value)}`,
    ops: [{ op: 'add', path: `/workflows/${id}`, value }],
  })
  selectedId.value = id
  createOpen.value = false
}

const removeWfOpen = ref(false)
function removeWorkflow() {
  if (!wf.value) return
  def.apply({
    key: `workflows.${wf.value.id}`,
    area: 'Workflow',
    text: `Removed ${wf.value.name} workflow`,
    ops: [{ op: 'remove', path: base.value }],
  })
  removeWfOpen.value = false
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2.5">
    <PSegmented
      v-if="workflows.length > 1"
      v-model="selectedId"
      :options="wfOptions"
      :aria-label="t('settings.workflows.pick')"
    />
    <PButton :icon="Plus" class="ml-auto" @click="createOpen = true">{{
      t('settings.workflows.new')
    }}</PButton>
  </div>

  <PEmptyState
    v-if="!wf"
    :icon="WorkflowIcon"
    :title="t('settings.workflows.emptyTitle')"
    :description="t('settings.workflows.emptyDesc')"
  >
    <PButton variant="primary" :icon="Plus" @click="createOpen = true">{{
      t('settings.workflows.new')
    }}</PButton>
  </PEmptyState>

  <template v-else>
    <SettingsCard>
      <div class="flex flex-wrap items-center gap-2.5 border-b border-line-faint px-5 py-4">
        <div class="grid size-[34px] place-items-center rounded-[9px] bg-info-bg text-info">
          <WorkflowIcon :size="16" />
        </div>
        <div class="min-w-[200px] flex-1">
          <div class="text-xl font-bold">{{ t('settings.workflows.title', { name: wf.name }) }}</div>
          <div class="text-sm text-faint">
            {{ t('settings.workflows.runsOn', { table: tableName(wf.table) }) }}
          </div>
        </div>
        <span class="text-xs text-muted">{{
          t('settings.workflows.counts', { s: wf.states.length, tr: wf.transitions.length })
        }}</span>
        <PButton
          size="xs"
          variant="ghost"
          :icon="Trash2"
          :aria-label="t('settings.workflows.delete')"
          :title="t('settings.workflows.delete')"
          square
          @click="removeWfOpen = true"
        />
      </div>
      <div class="border-b border-line-faint bg-bg-home px-5 py-3">
        <WorkflowDiagram :workflow="wf" />
      </div>

      <!-- States -->
      <div class="flex items-center gap-2 px-5 pb-1 pt-4">
        <span class="eyebrow">{{ t('settings.workflows.states') }}</span>
      </div>
      <div class="px-3 pb-3">
        <div
          v-for="(s, i) in wf.states"
          :key="s.id"
          class="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-hover"
        >
          <div class="flex flex-col">
            <button
              type="button"
              class="grid h-3.5 w-5 place-items-center text-faint hover:text-fg disabled:opacity-30"
              :disabled="i === 0"
              :aria-label="t('settings.workflows.up', { name: s.name })"
              @click="move(s, -1)"
            >
              <ArrowUp :size="12" />
            </button>
            <button
              type="button"
              class="grid h-3.5 w-5 place-items-center text-faint hover:text-fg disabled:opacity-30"
              :disabled="i === wf.states.length - 1"
              :aria-label="t('settings.workflows.down', { name: s.name })"
              @click="move(s, 1)"
            >
              <ArrowDown :size="12" />
            </button>
          </div>
          <span :class="cn('size-2.5 shrink-0 rounded-full', toneClasses[toneOf(s.id)].dot)" />
          <PInput
            v-model="names[s.id]"
            size="sm"
            class="w-[200px]"
            :aria-label="t('settings.workflows.stateName')"
            @blur="rename(s)"
            @keydown.enter="rename(s)"
          />
          <span class="w-[130px] truncate font-mono text-xs text-faint">{{ s.id }}</span>
          <PSelect
            :model-value="s.tone ?? 'neutral'"
            :options="toneOptions"
            size="sm"
            class="w-[120px]"
            :aria-label="t('settings.workflows.tone')"
            @update:model-value="(v) => v && setTone(s, v)"
          />
          <PCheckbox
            :model-value="!!s.final"
            :label="t('settings.workflows.final')"
            @update:model-value="(v) => setFinal(s, v === true)"
          />
          <PButton
            square
            size="xs"
            variant="ghost"
            :icon="Trash2"
            class="ml-auto"
            :aria-label="t('settings.workflows.removeState', { name: s.name })"
            @click="deleting = s"
          />
        </div>
        <div class="mt-1 flex items-center gap-2 px-2">
          <PInput
            v-model="newState"
            size="sm"
            class="w-[220px]"
            :placeholder="t('settings.workflows.newState')"
            :aria-label="t('settings.workflows.newState')"
            @keydown.enter="addState"
          />
          <PButton size="xs" variant="ink" :icon="Plus" :disabled="!newState.trim()" @click="addState">{{
            t('settings.workflows.addState')
          }}</PButton>
        </div>
      </div>

      <!-- Transitions -->
      <div class="overflow-x-auto border-t border-line-faint">
        <div class="min-w-[760px]">
          <div
            class="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.5fr)_36px] border-b border-line-soft bg-bg-home text-xs font-semibold text-muted"
          >
            <div class="px-5 py-2.5">{{ t('settings.workflows.move') }}</div>
            <div class="px-3 py-2.5">{{ t('settings.workflows.requires') }}</div>
            <div class="px-3 py-2.5">{{ t('settings.workflows.who') }}</div>
            <div />
          </div>
          <div
            v-for="(tr, i) in wf.transitions"
            :key="`${tr.from}>${tr.to}#${i}`"
            class="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.5fr)_36px] items-center border-b border-line-faint text-base"
          >
            <div class="flex items-center gap-1.5 px-5 py-2">
              <PSelect
                :model-value="tr.from"
                :options="stateOptions"
                size="sm"
                class="w-[140px]"
                :aria-label="t('settings.workflows.from')"
                @update:model-value="(v) => setEnd(i, 'from', v)"
              />
              <ArrowRight :size="13" class="shrink-0 text-faint" />
              <PSelect
                :model-value="tr.to"
                :options="stateOptions"
                size="sm"
                class="w-[140px]"
                :aria-label="t('settings.workflows.to')"
                @update:model-value="(v) => setEnd(i, 'to', v)"
              />
            </div>
            <div class="px-3 py-2">
              <PInput
                v-model="labels[i]"
                size="sm"
                :placeholder="t('settings.workflows.requiresPlaceholder')"
                :aria-label="t('settings.workflows.requires')"
                @blur="saveLabel(i)"
                @keydown.enter="saveLabel(i)"
              />
            </div>
            <div class="flex flex-wrap items-center gap-1 px-3 py-2">
              <button
                v-for="r in roles"
                :key="r.id"
                type="button"
                :aria-pressed="tr.roles.includes(r.id)"
                :class="
                  cn(
                    'h-6 rounded-full border px-2 text-xs font-semibold transition-colors',
                    tr.roles.includes(r.id)
                      ? 'border-primary-ring bg-primary-tint text-primary-strong'
                      : 'border-line bg-surface text-faint hover:text-fg',
                  )
                "
                @click="toggleRole(i, r.id)"
              >
                {{ r.name }}
              </button>
              <PBadge v-if="!tr.roles.length" size="xs" tone="warn">{{
                t('settings.workflows.nobody')
              }}</PBadge>
            </div>
            <div>
              <PButton
                square
                size="xs"
                variant="ghost"
                :icon="Trash2"
                :aria-label="t('settings.workflows.removeMove')"
                @click="removeTransition(i)"
              />
            </div>
          </div>
          <div class="px-5 py-2.5">
            <PButton size="xs" variant="ghost" :icon="Plus" @click="addTransition">{{
              t('settings.workflows.addMove')
            }}</PButton>
          </div>
        </div>
      </div>
    </SettingsCard>
  </template>

  <PDialog
    v-model:open="deleteOpen"
    :title="t('settings.workflows.removeStateTitle', { name: deleting?.name })"
    :icon="Trash2"
  >
    <p class="text-base text-fg-2">
      {{
        deletingUses
          ? t('settings.workflows.removeStateUses', { n: deletingUses })
          : t('settings.workflows.removeStateDesc')
      }}
    </p>
    <template #footer="{ close }">
      <PButton @click="close">{{ t('settings.cancel') }}</PButton>
      <PButton variant="danger" @click="removeState">{{
        t('settings.workflows.removeStateConfirm')
      }}</PButton>
    </template>
  </PDialog>

  <PDialog
    v-model:open="removeWfOpen"
    :title="t('settings.workflows.deleteTitle', { name: wf?.name })"
    :description="t('settings.workflows.deleteDesc')"
    :icon="Trash2"
  >
    <template #footer="{ close }">
      <PButton @click="close">{{ t('settings.cancel') }}</PButton>
      <PButton variant="danger" @click="removeWorkflow">{{ t('settings.workflows.delete') }}</PButton>
    </template>
  </PDialog>

  <PDialog
    v-model:open="createOpen"
    :title="t('settings.workflows.new')"
    :description="t('settings.workflows.newDesc')"
    :icon="WorkflowIcon"
    :width="440"
  >
    <div class="flex flex-col gap-3.5">
      <PField v-slot="{ id }" :label="t('settings.workflows.name')" required>
        <PInput
          :id="id"
          v-model="newName"
          :placeholder="t('settings.workflows.namePlaceholder')"
          @keydown.enter="createWorkflow"
        />
      </PField>
      <PField :label="t('settings.workflows.table')">
        <PSelect v-model="newTable" :options="tableOptions" :aria-label="t('settings.workflows.table')" />
      </PField>
    </div>
    <template #footer="{ close }">
      <PButton @click="close">{{ t('settings.cancel') }}</PButton>
      <PButton variant="primary" :disabled="!newName.trim() || !newTable" @click="createWorkflow">{{
        t('settings.workflows.create')
      }}</PButton>
    </template>
  </PDialog>
</template>
