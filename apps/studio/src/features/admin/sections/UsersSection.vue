<script setup lang="ts">
/** Users: everyone who can sign in to the Studio — invite, change Studio role, deactivate. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, UserPlus } from 'lucide-vue-next'
import {
  PAvatar,
  PBadge,
  PButton,
  PField,
  PInput,
  PSelect,
  PSpinner,
  PSwitch,
  type SelectOption,
} from '@platon/ui'
import type { AdminUser, StudioRole } from '@platon/definition'
import { useSessionStore } from '@/stores/session'
import { relTime } from '@/composables/format'
import { http } from '@/services/http'
import AdminCard from '../components/AdminCard.vue'
import { adminKeys, useAdminMutation, useUsers } from '../api'

const { t } = useI18n()
const session = useSessionStore()
const users = useUsers()

const ROLES: StudioRole[] = ['owner', 'admin', 'editor', 'viewer']
const roleOptions = computed<SelectOption<StudioRole>[]>(() =>
  ROLES.map((r) => ({ value: r, label: t(`admin.roles.${r}`) })),
)
const inviteOptions = computed(() => roleOptions.value.filter((o) => o.value !== 'owner'))

const q = ref('')
const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  return (users.data.value ?? []).filter(
    (u) => !s || `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(s),
  )
})

const replaceUser = (u: AdminUser) => (users.data.value ?? []).map((x) => (x.id === u.id ? u : x))
const patch = useAdminMutation(
  async (v: { id: string; body: Partial<Pick<AdminUser, 'role' | 'active'>> }) =>
    (await http.patch<AdminUser>(`/admin/users/${v.id}`, v.body)).data,
  {
    key: adminKeys.users,
    set: replaceUser,
    success: (u, v) =>
      v.body.role
        ? t('admin.users.roleChanged', { name: u.name, role: t(`admin.roles.${u.role}`) })
        : u.active
          ? t('admin.users.reactivated', { name: u.name })
          : t('admin.users.deactivated', { name: u.name }),
    invalidate: [adminKeys.roles],
  },
)

const inviting = ref(false)
const email = ref('')
const role = ref<StudioRole>('editor')
const emailError = ref<string | null>(null)
const invite = useAdminMutation(
  async () =>
    (await http.post<AdminUser>('/admin/users', { email: email.value.trim(), role: role.value })).data,
  {
    invalidate: [adminKeys.users],
    success: (u) => t('admin.users.invited', { email: u.email }),
  },
)
function send() {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) {
    emailError.value = t('admin.users.emailInvalid')
    return
  }
  invite.mutate(undefined, {
    onSuccess: () => {
      inviting.value = false
      email.value = ''
    },
  })
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2.5">
    <PInput
      v-model="q"
      :icon="Search"
      size="lg"
      class="min-w-[220px] flex-1"
      :placeholder="t('admin.users.search')"
      :aria-label="t('admin.users.search')"
    />
    <PButton variant="primary" :icon="UserPlus" @click="inviting = !inviting">{{
      t('admin.users.invite')
    }}</PButton>
  </div>

  <div
    v-if="inviting"
    class="flex flex-wrap items-end gap-2.5 rounded-xl border border-primary-ring bg-primary-tint/40 p-3.5"
  >
    <PField v-slot="{ id }" :label="t('admin.users.email')" :error="emailError" class="min-w-[220px] flex-1">
      <PInput
        :id="id"
        v-model="email"
        type="email"
        :invalid="!!emailError"
        :placeholder="t('admin.users.emailPlaceholder')"
        @keydown.enter="send"
        @input="emailError = null"
      />
    </PField>
    <PField :label="t('admin.users.role')" class="w-40">
      <PSelect v-model="role" :options="inviteOptions" :aria-label="t('admin.users.role')" />
    </PField>
    <PButton variant="primary" size="md" :loading="invite.isPending.value" @click="send">{{
      t('admin.users.send')
    }}</PButton>
    <PButton size="md" variant="ghost" @click="inviting = false">{{ t('admin.cancel') }}</PButton>
  </div>

  <div v-if="users.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <AdminCard v-else>
    <div class="overflow-x-auto scroll-thin">
      <div class="min-w-[820px]">
        <div
          class="grid grid-cols-[minmax(220px,1.6fr)_140px_80px_minmax(110px,0.7fr)_110px_90px] border-b border-line-soft bg-bg-home text-xs font-semibold text-muted"
        >
          <div class="px-3.5 py-2.5">{{ t('admin.users.user') }}</div>
          <div class="px-3.5 py-2.5">{{ t('admin.users.role') }}</div>
          <div class="px-3.5 py-2.5">{{ t('admin.users.projects') }}</div>
          <div class="px-3.5 py-2.5">{{ t('admin.users.lastActive') }}</div>
          <div class="px-3.5 py-2.5">{{ t('admin.users.status') }}</div>
          <div class="px-3.5 py-2.5 text-right">{{ t('admin.users.access') }}</div>
        </div>
        <div
          v-for="u in list"
          :key="u.id"
          class="grid grid-cols-[minmax(220px,1.6fr)_140px_80px_minmax(110px,0.7fr)_110px_90px] items-center border-b border-line-faint text-base last:border-b-0"
          :class="u.active ? '' : 'opacity-60'"
        >
          <div class="flex min-w-0 items-center gap-2.5 px-3.5 py-2.5">
            <PAvatar :name="u.name" :size="30" />
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 truncate font-semibold">
                {{ u.name
                }}<PBadge v-if="u.id === session.user?.id" size="xs" tone="primary">{{
                  t('admin.users.you')
                }}</PBadge>
              </div>
              <div class="truncate text-xs text-faint">{{ u.email }}</div>
            </div>
          </div>
          <div class="px-3.5 py-2">
            <PSelect
              :model-value="u.role"
              :options="roleOptions"
              size="sm"
              :aria-label="t('admin.users.roleFor', { name: u.name })"
              @update:model-value="
                (r) =>
                  r &&
                  r !== u.role &&
                  patch.mutate({ id: u.id, body: { role: r } }, { onError: () => users.refetch() })
              "
            />
          </div>
          <div class="px-3.5 py-2.5 text-fg-2">{{ u.projects }}</div>
          <div class="px-3.5 py-2.5 text-fg-2">
            {{ u.invited && !u.lastActiveAt ? t('admin.users.invitedState') : relTime(u.lastActiveAt) }}
          </div>
          <div class="px-3.5 py-2.5">
            <PBadge size="xs" :tone="!u.active ? 'neutral' : u.invited ? 'warn' : 'ok'">{{
              !u.active
                ? t('admin.users.deactivatedState')
                : u.invited
                  ? t('admin.users.pending')
                  : t('admin.users.active')
            }}</PBadge>
          </div>
          <div class="flex justify-end px-3.5 py-2.5">
            <PSwitch
              :model-value="u.active"
              :disabled="u.id === session.user?.id"
              :label="
                u.active
                  ? t('admin.users.deactivate', { name: u.name })
                  : t('admin.users.reactivate', { name: u.name })
              "
              @update:model-value="(v) => patch.mutate({ id: u.id, body: { active: v } })"
            />
          </div>
        </div>
        <div v-if="!list.length" class="p-6 text-center text-base text-faint">
          {{ t('admin.users.none') }}
        </div>
      </div>
    </div>
  </AdminCard>
</template>
