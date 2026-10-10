<script setup lang="ts">
/** Modules catalogue: features available to every project. Only admins change these; projects can't override. */
import { useI18n } from 'vue-i18n'
import { PIcon, PSpinner, PSwitch } from '@platon/ui'
import type { AdminModuleGroup } from '@platon/definition'
import { http } from '@/services/http'
import AdminCard from '../components/AdminCard.vue'
import { adminKeys, useAdminMutation, useModules } from '../api'

const { t } = useI18n()
const modules = useModules()
const toggle = useAdminMutation(
  async (v: { group: string; id: string; label: string; enabled: boolean }) =>
    (
      await http.patch<{ items: AdminModuleGroup[] }>(`/admin/modules/${v.group}/${v.id}`, {
        enabled: v.enabled,
      })
    ).data.items,
  {
    key: adminKeys.modules,
    success: (_r, v) =>
      v.enabled ? t('admin.modules.on', { name: v.label }) : t('admin.modules.off', { name: v.label }),
  },
)
</script>

<template>
  <div v-if="modules.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <AdminCard v-for="g in modules.data.value ?? []" :key="g.id">
    <div class="border-b border-line-faint bg-bg-home px-[18px] py-3">
      <div class="eyebrow">{{ g.label }}</div>
      <div class="mt-0.5 text-xs text-faint">
        {{ g.description }}<template v-if="g.keepOne"> · {{ t('admin.modules.keepOne') }}</template>
      </div>
    </div>
    <div
      v-for="m in g.items"
      :key="m.id"
      class="flex flex-wrap items-center gap-3 border-b border-line-faint px-[18px] py-3 last:border-b-0"
    >
      <div
        class="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-subtle text-fg-2"
        :class="m.enabled ? '' : 'opacity-60'"
      >
        <PIcon :name="m.icon" :size="16" />
      </div>
      <div class="min-w-[200px] flex-1" :class="m.enabled ? '' : 'opacity-60'">
        <div class="text-md font-semibold">{{ m.label }}</div>
        <div class="text-xs text-faint">{{ m.description }}</div>
      </div>
      <span v-if="m.impact" class="rounded-md bg-subtle px-2 py-0.5 text-xs text-muted">{{
        t('admin.modules.usedBy', { what: m.impact })
      }}</span>
      <span class="w-7 text-xs font-semibold" :class="m.enabled ? 'text-ok' : 'text-faint'">{{
        m.enabled ? t('admin.modules.onShort') : t('admin.modules.offShort')
      }}</span>
      <PSwitch
        :model-value="m.enabled"
        :label="m.label"
        @update:model-value="(v) => toggle.mutate({ group: g.id, id: m.id, label: m.label, enabled: v })"
      />
    </div>
  </AdminCard>
</template>
