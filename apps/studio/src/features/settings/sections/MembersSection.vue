<script setup lang="ts">
/** Members: Studio users on this project, their Studio role, invite and remove (last-owner rules come from the API). */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { Mail, Trash2, UserMinus, UserPlus } from 'lucide-vue-next'
import {
  PAvatar,
  PBadge,
  PButton,
  PDialog,
  PInput,
  PSelect,
  PSpinner,
  toast,
  type SelectOption,
} from '@platon/ui'
import type { Member, StudioRole } from '@platon/definition'
import { useSessionStore } from '@/stores/session'
import { useProjectId } from '@/composables/useProject'
import { relTime } from '@/composables/format'
import { errorMessage, http } from '@/services/http'
import SettingsCard from '../components/SettingsCard.vue'
import { settingsKeys, useMembers } from '../api'

const { t } = useI18n()
const qc = useQueryClient()
const pid = useProjectId()
const session = useSessionStore()
const members = useMembers(pid)

const ROLES: StudioRole[] = ['owner', 'admin', 'editor', 'viewer']
const roleOptions = computed<SelectOption<StudioRole>[]>(() =>
  ROLES.map((r) => ({
    value: r,
    label: t(`settings.roles.${r}`),
    description: t(`settings.members.roleDesc.${r}`),
  })),
)
const inviteOptions = computed(() => roleOptions.value.filter((o) => o.value !== 'owner'))
const canManage = computed(() => session.user?.role === 'owner' || session.user?.role === 'admin')

const invalidate = () => qc.invalidateQueries({ queryKey: settingsKeys.members(pid.value) })

const email = ref('')
const inviteRole = ref<StudioRole>('editor')
const emailError = ref<string | null>(null)
const invite = useMutation({
  mutationFn: async () =>
    (
      await http.post<Member>(`/projects/${pid.value}/members`, {
        email: email.value.trim(),
        role: inviteRole.value,
      })
    ).data,
  onSuccess: (m) => {
    toast(t('settings.members.invited', { email: m.email }), { tone: 'ok' })
    email.value = ''
    emailError.value = null
    void invalidate()
  },
  onError: (e) => (emailError.value = errorMessage(e)),
})
function sendInvite() {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) {
    emailError.value = t('settings.members.emailInvalid')
    return
  }
  invite.mutate()
}

const changeRole = useMutation({
  mutationFn: async (v: { m: Member; role: StudioRole }) =>
    (await http.patch<Member>(`/projects/${pid.value}/members/${v.m.id}`, { role: v.role })).data,
  onSuccess: (m) =>
    toast(t('settings.members.roleChanged', { name: m.name, role: t(`settings.roles.${m.role}`) }), {
      tone: 'ok',
    }),
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
  // Refetch either way so a rejected change snaps the select back.
  onSettled: () => void invalidate(),
})

const removing = ref<Member | null>(null)
const removeOpen = computed({ get: () => !!removing.value, set: (v) => !v && (removing.value = null) })
const remove = useMutation({
  mutationFn: async (m: Member) => http.delete(`/projects/${pid.value}/members/${m.id}`),
  onSuccess: (_r, m) => {
    toast(t('settings.members.removed', { name: m.name }), { tone: 'ok' })
    removing.value = null
    void invalidate()
  },
  onError: (e) => {
    removing.value = null
    toast(errorMessage(e), { tone: 'danger' })
  },
})

const ownerCount = computed(() => (members.data.value ?? []).filter((m) => m.role === 'owner').length)
const isMe = (m: Member) => m.id === session.user?.id
</script>

<template>
  <div v-if="canManage" class="flex flex-wrap items-start gap-2">
    <div class="min-w-[220px] flex-1">
      <PInput
        v-model="email"
        size="lg"
        type="email"
        :icon="Mail"
        :invalid="!!emailError"
        :placeholder="t('settings.members.emailPlaceholder')"
        :aria-label="t('settings.members.email')"
        @keydown.enter="sendInvite"
        @input="emailError = null"
      />
      <p v-if="emailError" class="mt-1 text-xs text-danger">{{ emailError }}</p>
    </div>
    <PSelect
      v-model="inviteRole"
      :options="inviteOptions"
      class="h-[38px] w-40"
      :aria-label="t('settings.members.role')"
    />
    <PButton
      variant="primary"
      size="lg"
      :icon="UserPlus"
      :loading="invite.isPending.value"
      @click="sendInvite"
      >{{ t('settings.members.invite') }}</PButton
    >
  </div>

  <SettingsCard>
    <div v-if="members.isLoading.value" class="grid place-items-center py-10 text-muted"><PSpinner /></div>
    <div
      v-for="m in members.data.value ?? []"
      :key="m.id"
      class="flex flex-wrap items-center gap-3 border-b border-line-faint px-[18px] py-3 last:border-b-0"
    >
      <PAvatar :name="m.name" :size="34" />
      <div class="min-w-[180px] flex-1">
        <div class="flex items-center gap-2 text-md font-semibold">
          {{ m.name }}
          <PBadge v-if="isMe(m)" size="xs" tone="primary">{{ t('settings.members.you') }}</PBadge>
          <PBadge v-if="m.invitedAt && !m.lastSeenAt" size="xs" tone="warn">{{
            t('settings.members.pending')
          }}</PBadge>
        </div>
        <div class="text-xs text-faint">{{ m.email }}</div>
      </div>
      <span class="min-w-[110px] text-xs text-faint">{{
        m.lastSeenAt
          ? t('settings.members.active', { when: relTime(m.lastSeenAt) })
          : t('settings.members.invitedAt', { when: relTime(m.invitedAt) })
      }}</span>
      <PSelect
        :model-value="m.role"
        :options="roleOptions"
        size="sm"
        class="w-[130px]"
        :disabled="!canManage"
        :aria-label="t('settings.members.roleFor', { name: m.name })"
        @update:model-value="(r) => r && r !== m.role && changeRole.mutate({ m, role: r })"
      />
      <PButton
        v-if="canManage"
        square
        size="sm"
        variant="ghost"
        :icon="Trash2"
        :title="
          m.role === 'owner' && ownerCount === 1
            ? t('settings.members.lastOwner')
            : t('settings.members.remove')
        "
        :aria-label="t('settings.members.removeName', { name: m.name })"
        @click="removing = m"
      />
    </div>
  </SettingsCard>

  <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
    <div v-for="r in ROLES" :key="r" class="rounded-xl border border-line-2 bg-surface px-[15px] py-[13px]">
      <div class="text-base font-bold">{{ t(`settings.roles.${r}`) }}</div>
      <div class="mt-1 text-sm leading-snug text-muted">{{ t(`settings.members.roleDesc.${r}`) }}</div>
    </div>
  </div>

  <PDialog
    v-model:open="removeOpen"
    :title="t('settings.members.removeTitle', { name: removing?.name })"
    :description="t('settings.members.removeDesc')"
    :icon="UserMinus"
  >
    <template #footer="{ close }">
      <PButton @click="close">{{ t('settings.cancel') }}</PButton>
      <PButton
        variant="danger"
        :loading="remove.isPending.value"
        @click="removing && remove.mutate(removing)"
        >{{ t('settings.members.remove') }}</PButton
      >
    </template>
  </PDialog>
</template>
