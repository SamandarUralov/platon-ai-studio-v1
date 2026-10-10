<script setup lang="ts">
/** Roles & permissions matrix: Studio roles × permissions. Owner is locked to every permission. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Lock, Plus, Trash2 } from 'lucide-vue-next'
import { PButton, PInput, PSpinner, cn } from '@platon/ui'
import type { AdminRole, AdminRolesResponse } from '@platon/definition'
import { http } from '@/services/http'
import AdminCard from '../components/AdminCard.vue'
import { adminKeys, useAdminMutation, useRoles, useUsers } from '../api'

const { t } = useI18n()
const roles = useRoles()
const users = useUsers()

const userCount = (r: AdminRole) => (users.data.value ?? []).filter((u) => u.active && u.role === r.id).length
const toggle = useAdminMutation(
  async (v: { role: AdminRole; permission: string; allowed: boolean }) =>
    (
      await http.patch<AdminRolesResponse>(`/admin/roles/${v.role.id}`, {
        permission: v.permission,
        allowed: v.allowed,
      })
    ).data,
  {
    key: adminKeys.roles,
  },
)
const create = useAdminMutation(
  async (name: string) => (await http.post<AdminRolesResponse>('/admin/roles', { name })).data,
  { key: adminKeys.roles, success: (_r, n) => t('admin.rolesPage.created', { name: n }) },
)
const remove = useAdminMutation(
  async (r: AdminRole) => (await http.delete<AdminRolesResponse>(`/admin/roles/${r.id}`)).data,
  { key: adminKeys.roles, success: (_r, r) => t('admin.rolesPage.deleted', { name: r.name }) },
)

const newRole = ref('')
function add() {
  const n = newRole.value.trim()
  if (!n) return
  create.mutate(n, { onSuccess: () => (newRole.value = '') })
}
const cols = computed(() => roles.data.value?.roles ?? [])
</script>

<template>
  <div v-if="roles.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <template v-else-if="roles.data.value">
    <AdminCard>
      <div class="overflow-x-auto scroll-thin">
        <table class="w-full min-w-[640px] border-collapse">
          <thead>
            <tr class="border-b border-line-soft bg-bg-home text-xs font-semibold text-muted">
              <th class="min-w-[240px] px-4 py-2.5 text-left font-semibold">
                {{ t('admin.rolesPage.permission') }}
              </th>
              <th v-for="r in cols" :key="r.id" class="w-[110px] px-2 py-2.5 text-center font-semibold">
                <div class="flex items-center justify-center gap-1 text-fg">
                  {{ r.name }}
                  <button
                    v-if="!r.builtin"
                    type="button"
                    class="text-faint hover:text-danger"
                    :aria-label="t('admin.rolesPage.delete', { name: r.name })"
                    @click="remove.mutate(r)"
                  >
                    <Trash2 :size="12" />
                  </button>
                </div>
                <div class="font-medium text-faint">
                  {{ t('admin.rolesPage.users', { n: userCount(r) }, userCount(r)) }}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in roles.data.value.permissions"
              :key="p.id"
              class="border-b border-line-faint last:border-b-0"
            >
              <td class="px-4 py-2.5">
                <div class="text-base font-semibold">
                  {{ t(`admin.perms.${p.id.replace('.', '_')}`, p.label) }}
                </div>
                <div class="font-mono text-xs text-faint-2">{{ p.id }}</div>
              </td>
              <td v-for="r in cols" :key="r.id" class="text-center">
                <button
                  type="button"
                  role="checkbox"
                  :aria-checked="r.permissions.includes(p.id)"
                  :aria-label="`${r.name}: ${p.label}`"
                  :disabled="r.id === 'owner'"
                  :title="r.id === 'owner' ? t('admin.rolesPage.ownerLocked') : undefined"
                  :class="
                    cn(
                      'inline-grid size-[22px] place-items-center rounded-md border-[1.5px] text-on-accent transition-colors',
                      r.permissions.includes(p.id)
                        ? r.id === 'owner'
                          ? 'border-primary/50 bg-primary/50'
                          : 'border-primary bg-primary'
                        : 'border-line bg-surface hover:border-primary-ring',
                      r.id === 'owner' && 'cursor-not-allowed',
                    )
                  "
                  @click="
                    toggle.mutate({ role: r, permission: p.id, allowed: !r.permissions.includes(p.id) })
                  "
                >
                  <Check v-if="r.permissions.includes(p.id)" :size="13" :stroke-width="3" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminCard>
    <div class="flex flex-wrap items-center gap-2.5">
      <PInput
        v-model="newRole"
        class="w-[260px]"
        :placeholder="t('admin.rolesPage.newPlaceholder')"
        :aria-label="t('admin.rolesPage.new')"
        @keydown.enter="add"
      />
      <PButton :icon="Plus" :disabled="!newRole.trim()" :loading="create.isPending.value" @click="add">{{
        t('admin.rolesPage.add')
      }}</PButton>
      <span class="flex items-center gap-1.5 text-xs text-muted"
        ><Lock :size="12" />{{ t('admin.rolesPage.note') }}</span
      >
    </div>
  </template>
</template>
