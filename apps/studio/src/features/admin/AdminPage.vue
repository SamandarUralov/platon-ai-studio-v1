<script setup lang="ts">
/** Admin panel (whole Studio, admins only): grouped left nav + one section, addressed by /admin/:section. */
import { computed, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-vue-next'
import { PButton, PEmptyState, PIcon, PSpinner } from '@platon/ui'
import { useSessionStore } from '@/stores/session'
import { useAdminProjects, useDatabases, useSandboxes, useUsers } from './api'
import OverviewSection from './sections/OverviewSection.vue'
import StudioSection from './sections/StudioSection.vue'
import UsersSection from './sections/UsersSection.vue'
import RolesSection from './sections/RolesSection.vue'
import ProjectsSection from './sections/ProjectsSection.vue'
import AiSection from './sections/AiSection.vue'
import DatabasesSection from './sections/DatabasesSection.vue'
import SandboxesSection from './sections/SandboxesSection.vue'
import ModulesSection from './sections/ModulesSection.vue'
import AuditSection from './sections/AuditSection.vue'

const NAV: { group: string; items: { id: string; icon: string }[] }[] = [
  {
    group: 'studio',
    items: [
      { id: 'overview', icon: 'layout-dashboard' },
      { id: 'studio', icon: 'settings-2' },
    ],
  },
  {
    group: 'people',
    items: [
      { id: 'users', icon: 'users' },
      { id: 'roles', icon: 'shield' },
    ],
  },
  {
    group: 'platform',
    items: [
      { id: 'projects', icon: 'folder-kanban' },
      { id: 'ai', icon: 'sparkles' },
      { id: 'databases', icon: 'database' },
      { id: 'sandboxes', icon: 'box' },
      { id: 'modules', icon: 'blocks' },
    ],
  },
  { group: 'security', items: [{ id: 'audit', icon: 'scroll-text' }] },
]

const SECTIONS: Record<string, Component> = {
  overview: OverviewSection,
  studio: StudioSection,
  users: UsersSection,
  roles: RolesSection,
  projects: ProjectsSection,
  ai: AiSection,
  databases: DatabasesSection,
  sandboxes: SandboxesSection,
  modules: ModulesSection,
  audit: AuditSection,
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const session = useSessionStore()
void session.load()

const allowed = computed(() => !!session.session?.isPlatformAdmin)
const section = computed(() => {
  const s = String(route.params.section ?? '')
  return s in SECTIONS ? s : 'overview'
})
watch(
  () => route.params.section,
  (s) => {
    if (s && !(String(s) in SECTIONS)) void router.replace({ name: 'admin' })
  },
  { immediate: true },
)

// Badges only query once the panel is open to an admin.
const users = useUsers()
const projects = useAdminProjects()
const dbs = useDatabases()
const sandboxes = useSandboxes()
function badge(id: string): string | undefined {
  if (id === 'users')
    return users.data.value ? String(users.data.value.filter((u) => u.active).length) : undefined
  if (id === 'projects') return projects.data.value ? String(projects.data.value.length) : undefined
  if (id === 'databases') return dbs.data.value ? String(dbs.data.value.databases.length) : undefined
  if (id === 'sandboxes') {
    const n = sandboxes.data.value?.filter((s) => s.latest).length
    return n ? t('admin.updates', { n }) : undefined
  }
  return undefined
}

const back = () => (window.history.length > 1 ? router.back() : router.push({ name: 'home' }))
</script>

<template>
  <div v-if="session.loading && !session.session" class="grid flex-1 place-items-center py-20 text-muted">
    <PSpinner :size="20" />
  </div>
  <div v-else-if="!allowed" class="grid flex-1 place-items-center py-20">
    <PEmptyState :icon="ShieldAlert" :title="t('admin.denied')" :description="t('admin.deniedDesc')">
      <PButton @click="router.push({ name: 'home' })">{{ t('admin.allApps') }}</PButton>
    </PEmptyState>
  </div>
  <div v-else class="flex min-h-0 flex-1">
    <nav
      class="sticky top-[60px] h-[calc(100vh-60px)] w-[236px] shrink-0 overflow-auto border-r border-line-2 bg-bg-home px-2.5 py-4 scroll-thin"
      :aria-label="t('admin.title')"
    >
      <div class="flex items-center gap-2 px-2.5 pb-1 text-lg font-bold">
        <ShieldCheck :size="16" class="text-primary" />{{ t('admin.title') }}
      </div>
      <div class="px-2.5 pb-4 text-xs text-faint">{{ t('admin.subtitle') }}</div>
      <div v-for="g in NAV" :key="g.group" class="mb-4">
        <div class="eyebrow px-2.5 pb-1.5">{{ t(`admin.groups.${g.group}`) }}</div>
        <RouterLink
          v-for="it in g.items"
          :key="it.id"
          :to="{ name: 'admin', params: { section: it.id === 'overview' ? undefined : it.id } }"
          class="relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-md"
          :class="
            section === it.id
              ? 'bg-primary-tint font-bold text-primary-strong'
              : 'font-medium text-fg hover:bg-hover'
          "
          :aria-current="section === it.id ? 'page' : undefined"
        >
          <span
            v-if="section === it.id"
            class="absolute -left-2.5 top-2 bottom-2 w-[3px] rounded-sm bg-primary"
          />
          <PIcon :name="it.icon" :size="15" />
          <span class="min-w-0 flex-1 truncate">{{ t(`admin.nav.${it.id}`) }}</span>
          <span
            v-if="badge(it.id)"
            class="inline-flex h-5 items-center rounded-md border px-1.5 text-2xs font-semibold"
            :class="
              it.id === 'sandboxes'
                ? 'border-warn/30 bg-warn-bg text-warn'
                : 'border-line-2 bg-surface text-muted'
            "
          >
            {{ badge(it.id) }}
          </span>
        </RouterLink>
      </div>
      <button
        type="button"
        class="mx-2.5 mt-1 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
        @click="back"
      >
        <ArrowLeft :size="13" />{{ t('admin.back') }}
      </button>
    </nav>
    <div class="min-w-0 flex-1 px-8 pb-14 pt-7">
      <div class="mx-auto flex max-w-[1040px] flex-col gap-[18px]">
        <header>
          <h1 class="text-[23px] font-extrabold tracking-[-0.02em]">
            {{ t(`admin.sections.${section}.title`) }}
          </h1>
          <p class="mt-1 text-pretty text-lg text-muted">{{ t(`admin.sections.${section}.desc`) }}</p>
        </header>
        <component :is="SECTIONS[section]" :key="section" />
      </div>
    </div>
  </div>
</template>
