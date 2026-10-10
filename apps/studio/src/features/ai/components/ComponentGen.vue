<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Circle, CircleCheck, FileCode2, LoaderCircle, Puzzle } from 'lucide-vue-next'
import { PButton, cn } from '@platon/ui'
import type { AiComponentGen } from '@platon/definition'

const props = defineProps<{ gen: AiComponentGen; canOpen: boolean }>()
defineEmits<{ open: [] }>()
const { t } = useI18n()
const generating = computed(() => props.gen.status === 'generating')
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line bg-surface">
    <div class="flex min-w-0 items-center gap-2 border-b border-line-faint px-3 py-2.5">
      <Puzzle :size="14" class="shrink-0 text-primary" />
      <span class="min-w-0 truncate font-mono text-xs font-semibold text-fg">{{ gen.file }}</span>
      <span :class="cn('ml-auto shrink-0 text-xs font-semibold', generating ? 'text-primary' : 'text-warn')">
        {{ generating ? t('ai.gen.generating') : t('ai.gen.ready') }}
      </span>
    </div>
    <div class="flex flex-col gap-1.5 px-3 py-2.5">
      <div
        v-for="s in gen.steps"
        :key="s.label"
        :class="cn('flex items-center gap-2 text-sm', s.state === 'todo' ? 'text-faint' : 'text-fg')"
      >
        <CircleCheck v-if="s.state === 'done'" :size="14" class="shrink-0 text-ok" />
        <LoaderCircle v-else-if="s.state === 'on'" :size="14" class="shrink-0 animate-spin text-primary" />
        <Circle v-else :size="14" class="shrink-0 text-faint-2" />
        {{ s.label }}
      </div>
      <div v-if="gen.props.length" class="flex flex-wrap gap-1 pt-0.5">
        <span
          v-for="p in gen.props"
          :key="p.name"
          class="flex h-[22px] items-center gap-1 rounded-md bg-subtle px-1.5 font-mono text-2xs text-fg-2"
        >
          {{ p.name }}<span class="text-faint">{{ p.type }}</span>
        </span>
      </div>
    </div>
    <div v-if="!generating" class="px-3 pb-3">
      <PButton variant="ink" size="xs" :icon="FileCode2" :disabled="!canOpen" @click="$emit('open')">{{
        t('ai.gen.open', { name: gen.name })
      }}</PButton>
    </div>
  </div>
</template>
