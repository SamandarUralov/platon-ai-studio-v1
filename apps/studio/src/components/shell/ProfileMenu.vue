<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Settings,
  ShieldCheck,
  LayoutGrid,
  Keyboard,
  CircleHelp,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from 'lucide-vue-next'
import { PAvatar, PBadge, PKbd, PPopover, PSegmented, PSelect } from '@platon/ui'
import { useSessionStore, type ThemePref } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { STUDIO_LANGUAGES } from '@/app/i18n'
import { kbd } from '@/composables/useShortcuts'

const session = useSessionStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const open = defineModel<boolean>('open', { default: false })

const projectId = computed(() => route.params.projectId as string | undefined)
const themes = computed(() => [
  { value: 'light' as ThemePref, label: t('profile.light'), icon: Sun },
  { value: 'dark' as ThemePref, label: t('profile.dark'), icon: Moon },
  { value: 'system' as ThemePref, label: t('profile.system'), icon: Monitor },
])
const langs = STUDIO_LANGUAGES.map((l) => ({ value: l.id as string, label: l.label }))

interface MenuItem {
  icon: unknown
  label: string
  shortcut?: string
  go: () => unknown
}

const items = computed<MenuItem[]>(() => [
  ...(projectId.value
    ? [
        {
          icon: Settings,
          label: t('profile.projectSettings'),
          go: () => router.push({ name: 'settings', params: { projectId: projectId.value } }),
        },
      ]
    : []),
  ...(session.session?.isPlatformAdmin
    ? [{ icon: ShieldCheck, label: t('profile.admin'), go: () => router.push({ name: 'admin' }) }]
    : []),
  { icon: LayoutGrid, label: t('profile.allApps'), go: () => router.push({ name: 'home' }) },
  {
    icon: Keyboard,
    label: t('profile.shortcuts'),
    shortcut: kbd('mod+/'),
    go: () => (ui.shortcutsOpen = true),
  },
  {
    icon: CircleHelp,
    label: t('profile.help'),
    go: () => window.open('https://docs.platon.app', '_blank', 'noopener'),
  },
])

function run(go: () => unknown) {
  open.value = false
  void go()
}
async function logout() {
  open.value = false
  await session.logout()
  void router.push({ name: 'signed-out' })
}
</script>

<template>
  <PPopover v-model:open="open" align="end" :width="290">
    <template #trigger>
      <button
        type="button"
        class="grid size-[34px] shrink-0 place-items-center rounded-full shadow-[0_0_0_1px_var(--p-line)]"
        :title="session.user?.name"
        aria-label="Account, settings, theme"
      >
        <PAvatar :name="session.user?.name ?? 'You'" :size="32" />
      </button>
    </template>
    <div class="flex items-center gap-3 border-b border-line-faint p-3.5">
      <PAvatar :name="session.user?.name ?? 'You'" :size="38" />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 truncate text-md font-bold">
          {{ session.user?.name }}
          <PBadge tone="primary" size="xs" class="capitalize">{{ session.user?.role }}</PBadge>
        </div>
        <div class="truncate text-xs text-muted">{{ session.user?.email }}</div>
      </div>
    </div>
    <div class="p-1.5">
      <button
        v-for="it in items"
        :key="it.label"
        type="button"
        class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-base hover:bg-hover"
        @click="run(it.go)"
      >
        <component :is="it.icon" :size="15" class="text-muted" />
        <span class="flex-1 text-left">{{ it.label }}</span>
        <PKbd v-if="it.shortcut">{{ it.shortcut }}</PKbd>
      </button>
    </div>
    <div class="flex flex-col gap-2.5 border-t border-line-faint p-3">
      <div class="flex flex-col gap-1.5">
        <span class="eyebrow">{{ t('profile.theme') }}</span>
        <PSegmented v-model="session.theme" :options="themes" block aria-label="Theme" />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="eyebrow">{{ t('profile.language') }}</span>
        <PSelect v-model="session.studioLanguage" :options="langs" size="sm" aria-label="Studio language" />
      </div>
    </div>
    <div class="border-t border-line-faint p-1.5">
      <button
        type="button"
        class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-base text-danger hover:bg-danger-bg"
        @click="logout"
      >
        <LogOut :size="15" /> {{ t('profile.logout') }}
      </button>
    </div>
  </PPopover>
</template>
