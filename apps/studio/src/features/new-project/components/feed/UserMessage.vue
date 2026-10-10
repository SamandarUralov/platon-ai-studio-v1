<script setup lang="ts">
import type { StagedFile } from '../../flow'
import FileBadge from '../FileBadge.vue'

defineProps<{ text: string; files: StagedFile[] }>()
</script>

<template>
  <div class="flex flex-col items-end gap-2">
    <div
      class="max-w-[80%] text-pretty rounded-[16px_16px_4px_16px] bg-ink px-4 py-3 text-[14.5px] leading-relaxed text-on-ink"
    >
      {{ text }}
    </div>
    <div v-if="files.length" class="flex flex-wrap justify-end gap-1.5">
      <span
        v-for="f in files"
        :key="f.id"
        class="flex h-[30px] items-center gap-[7px] rounded-lg border border-line-2 bg-surface pl-[5px] pr-2.5 text-sm font-semibold"
      >
        <FileBadge :kind="f.kind" :badge="f.badge" small />{{ f.name }}
      </span>
    </div>
  </div>
</template>
