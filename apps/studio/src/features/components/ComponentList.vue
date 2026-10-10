<script setup lang="ts">
/** Overview of the project's custom components (route without an id). */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CodeXml, Plus, Puzzle, Sparkles } from 'lucide-vue-next'
import { PButton, PEmptyState } from '@platon/ui'
import type { CustomComponent } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import CustomComponentPreview from './CustomComponentPreview.vue'
import StatusChip from './StatusChip.vue'
import { generations, samples } from './useComponents'

const emit = defineEmits<{ open: [componentId: string]; create: [method: 'ai' | 'code'] }>()
const { t } = useI18n()
const def = useDefinitionStore()

const components = computed(() => def.definition?.components ?? [])
const usedOn = (c: CustomComponent) =>
  def.definition?.interface.pages.filter((p) => p.blocks.some((b) => b.component === c.id)).length ?? 0
const status = (c: CustomComponent) => (generations.has(c.id) ? 'building' : c.status)
</script>

<template>
  <div class="h-full overflow-auto scroll-thin">
    <div class="mx-auto max-w-[1080px] px-6 pb-16 pt-10">
      <div class="mb-6 flex flex-wrap items-end gap-4">
        <div class="min-w-0 flex-1">
          <div class="eyebrow mb-1.5">{{ t('components.chip.vue') }} · sandbox</div>
          <h1 class="m-0 text-[24px] font-extrabold tracking-[-0.02em]">{{ t('components.title') }}</h1>
          <p class="mt-1.5 max-w-[620px] text-md leading-relaxed text-muted">{{ t('components.lead') }}</p>
        </div>
        <div class="flex gap-2">
          <PButton variant="ai" size="md" :icon="Sparkles" @click="emit('create', 'ai')">{{
            t('components.askAi')
          }}</PButton>
          <PButton variant="primary" size="md" :icon="Plus" @click="emit('create', 'code')">{{
            t('components.new')
          }}</PButton>
        </div>
      </div>

      <PEmptyState
        v-if="!components.length"
        :icon="Puzzle"
        :title="t('components.empty')"
        :description="t('components.emptyLead')"
      >
        <PButton variant="primary" :icon="Plus" @click="emit('create', 'code')">{{
          t('components.new')
        }}</PButton>
      </PEmptyState>

      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-[18px]">
        <article
          v-for="c in components"
          :key="c.id"
          class="group flex cursor-pointer flex-col overflow-hidden rounded-[14px] border border-line-2 bg-surface transition-shadow hover:shadow-card focus-within:shadow-card"
          @click="emit('open', c.id)"
        >
          <div
            class="pointer-events-none relative h-[190px] overflow-hidden border-b border-line-faint bg-bg bg-dots px-5 pt-5"
            aria-hidden="true"
          >
            <CustomComponentPreview
              :component="c"
              :values="samples[c.id]"
              :building="status(c) === 'building'"
              :zoom="0.82"
            />
            <div class="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-bg to-transparent" />
          </div>
          <div class="flex flex-1 flex-col gap-1.5 px-[18px] pb-4 pt-3.5">
            <div class="flex min-w-0 items-center gap-2">
              <button
                type="button"
                class="min-w-0 truncate text-left text-xl font-bold outline-none focus-visible:underline"
                @click.stop="emit('open', c.id)"
              >
                {{ c.name }}
              </button>
              <span
                class="flex h-[18px] shrink-0 items-center gap-1 rounded-[5px] px-1.5 font-mono text-[10px] font-extrabold"
                :class="c.source.type === 'ai' ? 'bg-purple-bg text-purple' : 'bg-teal-bg text-teal'"
              >
                <component :is="c.source.type === 'ai' ? Sparkles : CodeXml" :size="10" />{{
                  c.source.type === 'ai' ? t('components.chip.ai') : t('components.chip.vue')
                }}
              </span>
              <StatusChip class="ml-auto" :status="status(c)" size="xs" />
            </div>
            <div class="truncate font-mono text-xs text-faint">{{ c.file }}</div>
            <div class="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
              <span>{{ t('components.props', c.props.length) }}</span>
              <span class="text-faint-2">·</span>
              <span>{{ t('components.usedOn', usedOn(c)) }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
