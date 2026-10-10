<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { ChevronDown, Check, Search, LayoutGrid, Plus } from 'lucide-vue-next'
import { PInput, PPopover, PStatusDot, PButton } from '@platon/ui'
import type { ProjectSummary } from '@platon/definition'
import { http } from '@/services/http'
import { useSessionStore } from '@/stores/session'
import { useDefinitionStore } from '@/stores/definition'
import { relTime, statusLabel } from '@/composables/format'

const props = defineProps<{ projectId: string }>()
const router = useRouter()
const { t } = useI18n()
const session = useSessionStore()
const def = useDefinitionStore()
const open = ref(false)
const q = ref('')

const { data } = useQuery({
  queryKey: ['projects'],
  queryFn: async () => (await http.get<{ items: ProjectSummary[] }>('/projects')).data.items,
})
const current = computed(() => data.value?.find((p) => p.id === props.projectId))
const list = computed(() =>
  (data.value ?? []).filter((p) => p.name.toLowerCase().includes(q.value.toLowerCase())),
)
const syncTone = computed(() =>
  def.sync === 'error' ? 'danger' : def.sync === 'saving' || def.sync === 'conflict' ? 'warn' : 'ok',
)

function go(p: ProjectSummary) {
  open.value = false
  void router.push({ name: 'interface', params: { projectId: p.id } })
}
</script>

<template>
  <PPopover v-model:open="open" :width="320" :side-offset="10">
    <template #trigger>
      <button
        type="button"
        class="-mx-2 flex min-w-[140px] flex-col rounded-lg px-2 py-1 text-left leading-tight hover:bg-hover"
        :class="open && 'bg-hover'"
        title="Switch app"
      >
        <span class="flex items-center gap-1.5 text-lg font-bold">
          <span class="max-w-[220px] truncate">{{ current?.name ?? def.definition?.name ?? '…' }}</span>
          <ChevronDown :size="13" class="text-faint" />
        </span>
        <span class="flex items-center gap-1.5 text-xs text-muted">
          <PStatusDot :tone="syncTone" :pulse="def.sync === 'saving'" />
          <span class="truncate">{{ t(`sync.${def.sync}`) }}</span>
        </span>
      </button>
    </template>
    <div class="border-b border-line-faint p-2.5">
      <PInput v-model="q" :icon="Search" :placeholder="t('switcher.find')" autofocus />
    </div>
    <div class="max-h-[300px] overflow-auto p-1.5 scroll-thin">
      <div class="eyebrow px-2 pb-1 pt-1.5">
        {{ t('switcher.apps', { org: session.session?.organization.name ?? '' }) }}
      </div>
      <button
        v-for="p in list"
        :key="p.id"
        type="button"
        class="flex w-full items-center gap-2.5 rounded-[9px] p-2 text-left hover:bg-hover"
        :class="p.id === projectId && 'bg-subtle-2'"
        @click="go(p)"
      >
        <span class="grid size-[30px] shrink-0 place-items-center rounded-lg" :style="{ background: p.tint }">
          <span class="size-3 rounded" :style="{ background: p.accent }" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-md font-semibold">{{ p.name }}</span>
          <span class="block text-xs text-faint">{{ statusLabel(p) }} · {{ relTime(p.updatedAt) }}</span>
        </span>
        <Check v-if="p.id === projectId" :size="15" class="text-primary" />
      </button>
      <div v-if="!list.length" class="px-2 py-3.5 text-center text-sm text-faint">
        {{ t('switcher.none') }}
      </div>
    </div>
    <div class="flex gap-1.5 border-t border-line-faint p-2.5">
      <PButton class="flex-1" :icon="LayoutGrid" @click="((open = false), router.push({ name: 'home' }))">{{
        t('switcher.all')
      }}</PButton>
      <PButton
        class="flex-1"
        variant="primary"
        :icon="Plus"
        @click="((open = false), router.push({ name: 'new-project' }))"
        >{{ t('switcher.new') }}</PButton
      >
    </div>
  </PPopover>
</template>
