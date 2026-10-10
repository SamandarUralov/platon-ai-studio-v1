<script setup lang="ts">
/** Project settings (requirements §3.8): grouped left nav + one section at a time, addressed by route. */
import { computed, defineAsyncComponent, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Settings } from 'lucide-vue-next'
import { PIcon, PSpinner } from '@platon/ui'
import { SETTINGS_SECTIONS } from '@/composables/useSearchIndex'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useDefinitionStore } from '@/stores/definition'
import { useMembers } from './api'
import GeneralSection from './sections/GeneralSection.vue'
import MembersSection from './sections/MembersSection.vue'
import AuthSection from './sections/AuthSection.vue'
import ModulesSection from './sections/ModulesSection.vue'
import WorkflowsSection from './sections/WorkflowsSection.vue'
import TranslationsSection from './sections/TranslationsSection.vue'
import GitSection from './sections/GitSection.vue'
import CicdSection from './sections/CicdSection.vue'

// Monaco is heavy: only load it when Agent.md is opened.
const AgentSection = defineAsyncComponent({
  loader: () => import('./sections/AgentSection.vue'),
  loadingComponent: PSpinner,
  delay: 120,
})

const SECTIONS: Record<string, Component> = {
  general: GeneralSection,
  members: MembersSection,
  auth: AuthSection,
  modules: ModulesSection,
  workflows: WorkflowsSection,
  translations: TranslationsSection,
  git: GitSection,
  cicd: CicdSection,
  agent: AgentSection,
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const pid = useProjectId()
const def = useDefinitionStore()
const members = useMembers(pid)

const section = computed(() => {
  const s = String(route.params.section ?? '')
  return s in SECTIONS ? s : 'general'
})
watch(
  () => route.params.section,
  (s) => {
    if (s && !(String(s) in SECTIONS)) void router.replace(projectLinks(pid.value).settings())
  },
  { immediate: true },
)

const groups = computed(() => {
  const out: { label: string; items: typeof SETTINGS_SECTIONS }[] = []
  for (const s of SETTINGS_SECTIONS) {
    let g = out.find((x) => x.label === s.group)
    if (!g) out.push((g = { label: s.group, items: [] }))
    g.items.push(s)
  }
  return out
})

function badge(id: string): string | undefined {
  const d = def.definition
  if (id === 'members') return members.data.value ? String(members.data.value.length) : undefined
  if (id === 'modules') return d ? String((d.settings.modules ?? []).length) : undefined
  if (id === 'workflows') return d ? String(d.workflows.length) : undefined
  if (id === 'translations') return d ? String(d.settings.languages.length) : undefined
  return undefined
}

const groupKey = (label: string) => label.toLowerCase().replace(/[^a-z]+/g, '_')
</script>

<template>
  <div class="flex h-full min-h-0">
    <nav
      class="w-[236px] shrink-0 overflow-auto border-r border-line-2 bg-bg-home px-2.5 py-4 scroll-thin"
      :aria-label="t('settings.title')"
    >
      <div class="flex items-center gap-2 px-2.5 pb-4 text-lg font-bold">
        <Settings :size="16" class="text-muted" />{{ t('settings.title') }}
      </div>
      <div v-for="g in groups" :key="g.label" class="mb-4">
        <div class="eyebrow px-2.5 pb-1.5">{{ t(`settings.groups.${groupKey(g.label)}`, g.label) }}</div>
        <RouterLink
          v-for="it in g.items"
          :key="it.id"
          :to="projectLinks(pid).settings(it.id)"
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
          <span class="min-w-0 flex-1 truncate">{{ t(`settings.nav.${it.id}`, it.label) }}</span>
          <span
            v-if="badge(it.id)"
            class="inline-flex h-5 items-center rounded-md border border-line-2 bg-surface px-1.5 text-2xs font-semibold text-muted"
            >{{ badge(it.id) }}</span
          >
        </RouterLink>
      </div>
    </nav>
    <div class="min-w-0 flex-1 overflow-auto px-8 pb-14 pt-7 scroll-thin">
      <div class="mx-auto flex max-w-[940px] flex-col gap-[18px]">
        <header>
          <h1 class="text-[23px] font-extrabold tracking-[-0.02em]">
            {{ t(`settings.sections.${section}.title`) }}
          </h1>
          <p class="mt-1 text-pretty text-lg text-muted">{{ t(`settings.sections.${section}.desc`) }}</p>
        </header>
        <component :is="SECTIONS[section]" :key="section" />
      </div>
    </div>
  </div>
</template>
