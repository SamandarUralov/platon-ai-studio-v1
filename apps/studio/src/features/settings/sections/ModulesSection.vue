<script setup lang="ts">
/** Modules: switch app modules on/off → definition.settings.modules (ships with the next release). */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Lock, Search } from 'lucide-vue-next'
import { PIcon, PInput, PSegmented, PSwitch, cn, toast, type SegmentOption } from '@platon/ui'
import { useDefinitionStore } from '@/stores/definition'
import SettingsCard from '../components/SettingsCard.vue'
import { MODULES, normaliseModule, type ModuleSpec } from '../catalog'

const { t } = useI18n()
const def = useDefinitionStore()

const enabled = computed(() => new Set((def.definition!.settings.modules ?? []).map(normaliseModule)))
const isOn = (m: ModuleSpec) => !!m.core || enabled.value.has(m.id)

const usage = computed(() => {
  const d = def.definition!
  return {
    tables: d.data.tables.length,
    crons: d.logic.crons.length,
    apis: d.logic.apis.length,
    workflows: d.workflows.length,
  }
})

const q = ref('')
type Tab = 'all' | 'on' | 'off'
const tab = ref<Tab>('all')
const onCount = computed(() => MODULES.filter(isOn).length)
const tabs = computed<SegmentOption<Tab>[]>(() => [
  { value: 'all', label: t('settings.modules.all', { n: MODULES.length }) },
  { value: 'on', label: t('settings.modules.on', { n: onCount.value }) },
  { value: 'off', label: t('settings.modules.off', { n: MODULES.length - onCount.value }) },
])

const visible = computed(() => {
  const s = q.value.trim().toLowerCase()
  return MODULES.filter((m) => {
    const text =
      `${t(`settings.modules.items.${m.id}.label`)} ${t(`settings.modules.items.${m.id}.desc`)}`.toLowerCase()
    return (!s || text.includes(s)) && (tab.value === 'all' || (tab.value === 'on') === isOn(m))
  })
})
const groups = computed(() =>
  [
    { id: 'core', items: visible.value.filter((m) => m.core) },
    { id: 'optional', items: visible.value.filter((m) => !m.core) },
  ].filter((g) => g.items.length),
)

function toggle(m: ModuleSpec, on: boolean) {
  const label = t(`settings.modules.items.${m.id}.label`)
  const next = new Set(enabled.value)
  if (on) next.add(m.id)
  else next.delete(m.id)
  def.apply({
    key: `settings.modules.${m.id}`,
    area: 'Settings',
    text: `${on ? 'Enabled' : 'Disabled'} ${label} module`,
    ops: [
      {
        op: def.definition!.settings.modules ? 'replace' : 'add',
        path: '/settings/modules',
        value: MODULES.filter((x) => !x.core && next.has(x.id)).map((x) => x.id),
      },
    ],
  })
  const used = m.usedBy?.(usage.value)
  if (!on && used) toast(t('settings.modules.offWarning', { name: label, used }), { tone: 'warn' })
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2.5">
    <PInput
      v-model="q"
      :icon="Search"
      size="lg"
      class="min-w-[220px] flex-1"
      :placeholder="t('settings.modules.search')"
      :aria-label="t('settings.modules.search')"
    />
    <PSegmented v-model="tab" :options="tabs" size="md" :aria-label="t('settings.modules.filter')" />
  </div>

  <SettingsCard v-for="g in groups" :key="g.id">
    <div class="flex items-center gap-2 border-b border-line-faint bg-bg-home px-[18px] py-[11px]">
      <span class="eyebrow">{{ t(`settings.modules.groups.${g.id}`) }}</span>
      <span class="text-xs text-faint">{{ g.items.length }}</span>
    </div>
    <div
      v-for="m in g.items"
      :key="m.id"
      class="flex flex-wrap items-center gap-3 border-b border-line-faint px-[18px] py-3 last:border-b-0"
      :class="isOn(m) ? '' : 'opacity-70'"
    >
      <div
        :class="
          cn(
            'grid size-[34px] shrink-0 place-items-center rounded-[9px]',
            isOn(m) ? 'bg-primary-tint text-primary-strong' : 'bg-subtle text-faint',
          )
        "
      >
        <PIcon :name="m.icon" :size="16" />
      </div>
      <div class="min-w-[200px] flex-1">
        <div class="flex flex-wrap items-center gap-2 text-md font-semibold">
          {{ t(`settings.modules.items.${m.id}.label`) }}
          <span class="font-mono text-xs font-medium text-faint-2">v{{ m.version }}</span>
        </div>
        <div class="mt-0.5 text-sm text-muted">
          {{ t(`settings.modules.items.${m.id}.desc`) }}
          <span v-if="m.usedBy?.(usage)" class="text-fg-2">
            · {{ t('settings.modules.usedBy', { what: m.usedBy(usage) }) }}</span
          >
        </div>
      </div>
      <span
        v-if="m.core"
        class="flex items-center gap-1.5 text-xs text-faint"
        :title="t('settings.modules.requiredHint')"
        ><Lock :size="13" />{{ t('settings.modules.required') }}</span
      >
      <PSwitch
        v-else
        :model-value="isOn(m)"
        :label="t(`settings.modules.items.${m.id}.label`)"
        @update:model-value="(v) => toggle(m, v)"
      />
    </div>
  </SettingsCard>
  <div
    v-if="!groups.length"
    class="rounded-[14px] border border-dashed border-line p-7 text-center text-base text-faint"
  >
    {{ t('settings.modules.empty') }}
  </div>
  <p class="text-xs leading-normal text-muted">{{ t('settings.modules.footnote') }}</p>
</template>
