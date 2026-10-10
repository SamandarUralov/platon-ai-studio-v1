<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  LayoutPanelTop,
  Braces,
  Database,
  HardDrive,
  Eye,
  Rocket,
  CodeXml,
  SquareTerminal,
  Pin,
  PinOff,
  History,
} from 'lucide-vue-next'
import { PAvatarStack, PSegmented, PButton, PTooltip } from '@platon/ui'
import { useQuery } from '@tanstack/vue-query'
import type { Presence } from '@platon/definition'
import { http } from '@/services/http'
import { useUiStore } from '@/stores/ui'
import { useDefinitionStore } from '@/stores/definition'
import { projectLinks } from '@/composables/useProject'
import { kbd } from '@/composables/useShortcuts'
import AppSwitcher from './AppSwitcher.vue'
import ProfileMenu from './ProfileMenu.vue'

const props = defineProps<{ projectId: string }>()
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const def = useDefinitionStore()
const { t } = useI18n()

type Layer = 'interface' | 'logic' | 'data' | 'storage' | 'preview'
const tabs = computed(() => [
  { value: 'interface' as Layer, label: t('nav.interface'), icon: LayoutPanelTop },
  { value: 'logic' as Layer, label: t('nav.logic'), icon: Braces },
  { value: 'data' as Layer, label: t('nav.data'), icon: Database },
  { value: 'storage' as Layer, label: t('nav.storage'), icon: HardDrive },
  { value: 'preview' as Layer, label: t('nav.preview'), icon: Eye },
])
const layer = computed<Layer>({
  get: () => (route.meta.layer as Layer) ?? ('' as Layer),
  set: (v) => void router.push({ name: v, params: { projectId: props.projectId } }),
})

const { data: presence } = useQuery({
  queryKey: ['presence', () => props.projectId],
  queryFn: async () =>
    (await http.get<{ items: Presence[] }>(`/projects/${props.projectId}/presence`)).data.items,
  refetchInterval: 30_000,
})
const people = computed(() =>
  (presence.value ?? []).map((p) => ({ name: p.name, title: `${p.name} · ${p.location}` })),
)

const pendingCount = computed(() => def.changes.length)
const consoleErrors = computed(() => def.errorCount)

const here = computed(() => ({
  path: route.fullPath,
  label: (route.meta.title as string) ?? 'Studio',
  icon: 'map-pin',
  layer: String(route.meta.layer ?? ''),
}))
const pinned = computed(() => ui.isPinned(route.fullPath))
const L = computed(() => projectLinks(props.projectId))
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-3.5 border-b border-line-2 bg-surface px-3.5">
    <button
      type="button"
      class="grid size-8 shrink-0 place-items-center rounded-[9px] bg-ink text-xl font-extrabold text-on-ink"
      title="All apps"
      @click="router.push({ name: 'home' })"
    >
      P
    </button>
    <AppSwitcher :project-id="projectId" />

    <div
      class="-ml-1.5 flex h-[30px] shrink-0 items-center overflow-hidden rounded-lg border border-line-soft"
    >
      <PTooltip :text="pinned ? 'Unpin this place' : 'Pin this place'">
        <button
          type="button"
          class="grid h-7 w-[30px] place-items-center hover:bg-hover"
          :class="pinned ? 'text-warn-dot' : 'text-muted'"
          :aria-label="pinned ? 'Unpin this place' : 'Pin this place'"
          :aria-pressed="pinned"
          @click="ui.togglePin(here)"
        >
          <component :is="pinned ? PinOff : Pin" :size="14" />
        </button>
      </PTooltip>
      <span class="h-4 w-px bg-line-soft" />
      <PTooltip :text="`Pinned & recent · ${kbd('mod+k')}`">
        <button
          type="button"
          class="flex h-7 items-center gap-1 px-2 text-sm font-semibold text-muted hover:bg-hover"
          aria-label="Pinned and recent"
          @click="ui.paletteOpen = true"
        >
          <History :size="14" />
          <span
            v-if="ui.pins.length"
            class="grid h-4 min-w-4 place-items-center rounded-lg bg-warn-bg px-1 text-2xs font-bold text-warn"
            >{{ ui.pins.length }}</span
          >
        </button>
      </PTooltip>
    </div>

    <div class="mx-auto min-w-0">
      <PSegmented v-model="layer" :options="tabs" size="md" aria-label="Studio layers" />
    </div>

    <div class="flex items-center gap-2">
      <PTooltip :text="`Console, tests and terminal (${kbd('ctrl+`')})`">
        <button
          type="button"
          class="relative grid size-8 place-items-center rounded-lg border"
          :class="
            ui.consoleOpen
              ? 'border-primary-ring bg-primary-tint text-primary-strong'
              : 'border-line text-fg-2 hover:bg-hover'
          "
          aria-label="Console"
          @click="ui.consoleOpen = !ui.consoleOpen"
        >
          <SquareTerminal :size="15" />
          <span
            v-if="consoleErrors"
            class="absolute -right-1 -top-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-danger-dot px-0.5 text-[10px] font-bold text-white"
            >{{ consoleErrors }}</span
          >
        </button>
      </PTooltip>
      <PButton
        :variant="route.name === 'advanced' ? 'tint' : 'outline'"
        :icon="CodeXml"
        title="Advanced: app definition"
        @click="router.push(L.advanced())"
        >{{ t('nav.advanced') }}</PButton
      >
      <PAvatarStack v-if="people.length" :people="people" :size="30" />
      <PButton
        variant="primary"
        size="md"
        :icon="Rocket"
        title="Open Releases"
        @click="router.push(L.releases())"
      >
        {{ t('nav.release') }}
        <span v-if="pendingCount" class="ml-0.5 rounded-full bg-white/20 px-1.5 text-2xs">{{
          pendingCount
        }}</span>
      </PButton>
      <ProfileMenu />
    </div>
  </header>
</template>
