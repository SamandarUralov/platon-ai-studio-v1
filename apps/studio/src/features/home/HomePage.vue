<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Sparkles, Paperclip, Copy, LayoutGrid } from 'lucide-vue-next'
import { PBadge, PButton, PEmptyState, PSpinner, toast } from '@platon/ui'
import type { ProjectSummary } from '@platon/definition'
import { errorMessage, http } from '@/services/http'
import { relTime, statusLabel } from '@/composables/format'
import CopyProjectDialog from './CopyProjectDialog.vue'

const router = useRouter()
const { t } = useI18n()
const qc = useQueryClient()
const prompt = ref('')
const copying = ref<ProjectSummary | null>(null)

const EXAMPLES = [
  [
    'Field service',
    'An app for field technicians to manage work orders, log hours and parts. Dispatchers assign jobs; customers see only their own jobs.',
  ],
  [
    'Purchase approvals',
    'Employees request purchases; managers approve under budget, finance approves above it. Track budgets per department.',
  ],
  [
    'Client onboarding',
    'Onboard new clients with a checklist, document uploads and a final sign-off from the account manager.',
  ],
  [
    'Inspections',
    'Inspectors fill safety checklists on site with photos; failed items create follow-up tasks with due dates.',
  ],
] as const

const { data: projects, isLoading } = useQuery({
  queryKey: ['projects'],
  queryFn: async () => (await http.get<{ items: ProjectSummary[] }>('/projects')).data.items,
})

const copy = useMutation({
  mutationFn: async (v: { from: ProjectSummary; name: string }) =>
    (
      await http.post<ProjectSummary>('/projects', {
        name: v.name,
        purpose: v.from.description,
        copyFrom: v.from.id,
        data: { sample: true },
      })
    ).data,
  onSuccess: (p) => {
    void qc.invalidateQueries({ queryKey: ['projects'] })
    copying.value = null
    toast(`Created ${p.name}`, {
      tone: 'ok',
      action: { label: 'Open', run: () => router.push({ name: 'interface', params: { projectId: p.id } }) },
    })
  },
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
})

const tone = (p: ProjectSummary) =>
  p.status === 'production' ? 'ok' : p.status === 'draft' ? 'neutral' : 'warn'
const count = computed(() => projects.value?.length ?? 0)

function draft() {
  void router.push({ name: 'new-project', query: prompt.value.trim() ? { prompt: prompt.value.trim() } : {} })
}
function open(p: ProjectSummary) {
  void router.push({ name: 'interface', params: { projectId: p.id } })
}
</script>

<template>
  <div>
    <section class="mx-auto max-w-[820px] px-6 pb-12 pt-[72px] text-center">
      <span
        class="inline-flex h-7 items-center gap-2 rounded-full bg-primary-tint px-3 text-sm font-semibold text-primary-strong"
      >
        <Sparkles :size="13" />{{ t('home.eyebrow') }}
      </span>
      <h1 class="mb-3 mt-[18px] text-balance text-[46px] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {{ t('home.title') }}
      </h1>
      <p class="mx-auto max-w-[560px] text-pretty text-[16.5px] leading-relaxed text-muted">
        {{ t('home.lead') }}
      </p>
      <div
        class="mt-8 overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-[0_1px_2px_rgba(20,20,40,.04),0_12px_32px_rgba(20,20,40,.06)]"
      >
        <textarea
          v-model="prompt"
          rows="4"
          :placeholder="t('home.placeholder')"
          aria-label="Describe your app"
          class="w-full resize-none bg-transparent px-5 pb-2 pt-5 text-[15.5px] leading-relaxed outline-none placeholder:text-faint-2"
          @keydown.meta.enter="draft"
          @keydown.ctrl.enter="draft"
        />
        <div class="flex items-center gap-2 px-3 pb-3 pl-3.5 pt-2.5">
          <PButton size="md" :icon="Paperclip" @click="draft">{{ t('home.attach') }}</PButton>
          <PButton variant="primary" size="lg" class="ml-auto" :icon="Sparkles" @click="draft">{{
            t('home.draft')
          }}</PButton>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <button
          v-for="[label, text] in EXAMPLES"
          :key="label"
          type="button"
          class="h-8 rounded-full border border-line bg-surface px-3 text-base text-fg-2 hover:border-primary-ring hover:text-primary-strong"
          @click="prompt = text"
        >
          {{ label }}
        </button>
      </div>
    </section>

    <section class="mx-auto max-w-[1080px] px-6 pb-[72px] pt-2">
      <div class="mb-4 flex items-baseline gap-2.5">
        <h2 class="m-0 text-[19px] font-bold tracking-[-0.01em]">{{ t('home.yourApps') }}</h2>
        <span class="text-base text-faint">{{ count }}</span>
      </div>
      <div v-if="isLoading" class="grid place-items-center py-16 text-muted"><PSpinner :size="20" /></div>
      <PEmptyState
        v-else-if="!count"
        :icon="LayoutGrid"
        title="No apps yet"
        description="Describe what you need above and Platon drafts the first version."
      />
      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-[18px]">
        <article
          v-for="p in projects"
          :key="p.id"
          class="flex flex-col overflow-hidden rounded-[14px] border border-line-2 bg-surface transition-shadow hover:shadow-card"
        >
          <button
            type="button"
            class="flex h-[150px] px-[22px] pt-[18px]"
            :style="{ background: p.tint }"
            :aria-label="`Open ${p.name}`"
            @click="open(p)"
          >
            <span
              class="flex flex-1 flex-col gap-2 rounded-t-[10px] bg-white p-3 shadow-[0_4px_14px_rgba(20,20,40,.08)]"
            >
              <span class="flex items-center gap-1.5">
                <span class="size-3.5 rounded" :style="{ background: p.accent }" />
                <span class="h-1.5 w-[50px] rounded bg-[#e6e6ee]" />
                <span class="ml-auto h-1.5 w-[30px] rounded bg-[#efeff4]" />
              </span>
              <span class="grid grid-cols-3 gap-1.5"
                ><span v-for="i in 3" :key="i" class="h-[26px] rounded-md bg-[#f5f5f8]"
              /></span>
              <span class="h-[7px] rounded bg-[#efeff4]" />
              <span class="h-[7px] w-4/5 rounded bg-[#efeff4]" />
              <span class="h-[7px] w-3/5 rounded bg-[#efeff4]" />
            </span>
          </button>
          <div class="flex flex-1 flex-col gap-1.5 px-[18px] pb-[18px] pt-4">
            <div class="text-[15.5px] font-bold">{{ p.name }}</div>
            <div class="text-base leading-snug text-muted">{{ p.description }}</div>
            <div v-if="p.copiedFrom" class="flex items-center gap-1.5 text-sm font-semibold text-teal">
              <Copy :size="12" />Copied from {{ p.copiedFrom }}
            </div>
            <div class="mt-2 flex items-center gap-2">
              <PBadge :tone="tone(p)">{{ statusLabel(p) }}</PBadge>
              <span class="text-sm text-faint">Edited {{ relTime(p.updatedAt) }}</span>
              <div class="ml-auto flex gap-1.5">
                <PButton square :icon="Copy" :label="t('home.duplicate')" @click="copying = p" />
                <PButton variant="ink" @click="open(p)">{{ t('common.open') }}</PButton>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <CopyProjectDialog
      v-if="copying"
      :project="copying"
      :busy="copy.isPending.value"
      @close="copying = null"
      @confirm="(name) => copy.mutate({ from: copying!, name })"
    />
  </div>
</template>
