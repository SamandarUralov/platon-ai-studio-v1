<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'
import { PSpinner } from '@platon/ui'
import type { AnalysedFile } from '../../flow'
import FileBadge from '../FileBadge.vue'

defineProps<{ files: AnalysedFile[] }>()
const { t } = useI18n()
</script>

<template>
  <ul class="overflow-hidden rounded-[14px] border border-line-2 bg-surface" aria-live="polite">
    <li
      v-for="f in files"
      :key="f.id"
      class="flex items-center gap-3 border-b border-line-faint px-3.5 py-3 last:border-b-0"
    >
      <FileBadge :kind="f.kind" :badge="f.badge" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-md font-semibold">{{ f.name }}</div>
        <div class="mt-px text-sm font-semibold" :class="f.status === 'done' ? 'text-teal' : 'text-primary'">
          {{ f.status === 'done' ? f.finding : t('newProject.feed.fileReading') }}
        </div>
      </div>
      <PSpinner v-if="f.status === 'parsing'" :size="16" class="text-primary" />
      <span v-else class="grid size-[22px] place-items-center rounded-full bg-teal-bg text-teal"
        ><Check :size="12" :stroke-width="3" aria-hidden="true"
      /></span>
    </li>
  </ul>
</template>
