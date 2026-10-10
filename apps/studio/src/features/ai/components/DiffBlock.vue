<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileCode2 } from 'lucide-vue-next'
import { PButton, cn } from '@platon/ui'
import type { AiDiff } from '@platon/definition'

const props = defineProps<{ diff: AiDiff; busy?: boolean }>()
defineEmits<{ apply: []; discard: [] }>()
const { t } = useI18n()

const added = computed(() => props.diff.lines.filter((l) => l.k === '+').length)
const removed = computed(() => props.diff.lines.filter((l) => l.k === '-').length)
const statusTone = computed(() =>
  props.diff.status === 'applied'
    ? 'text-ok'
    : props.diff.status === 'discarded'
      ? 'text-faint'
      : 'text-primary',
)
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line bg-surface">
    <div class="flex items-center gap-2 border-b border-line-faint px-3 py-2.5 text-sm font-bold">
      <FileCode2 :size="14" class="shrink-0 text-primary" />
      <span class="min-w-0 truncate font-mono text-xs font-medium text-fg">{{ diff.file }}</span>
      <span v-if="added" class="font-mono text-xs text-ok">+{{ added }}</span>
      <span v-if="removed" class="font-mono text-xs text-danger">−{{ removed }}</span>
      <span :class="cn('ml-auto shrink-0 font-semibold', statusTone)">{{ t(`ai.diff.${diff.status}`) }}</span>
    </div>
    <div class="overflow-auto bg-code-bg py-2 font-mono text-xs leading-[18px] scroll-thin">
      <div
        v-for="(l, i) in diff.lines"
        :key="i"
        :class="
          cn(
            'flex min-w-max pr-3 whitespace-pre',
            l.k === '+' && 'bg-ok-dot/15',
            l.k === '-' && 'bg-danger-dot/15',
          )
        "
      >
        <span
          :class="
            cn(
              'w-[22px] shrink-0 text-center',
              l.k === '+' ? 'text-ok-dot' : l.k === '-' ? 'text-danger-dot' : 'text-code-muted',
            )
          "
          >{{ l.k }}</span
        >
        <span class="text-code-fg">{{ l.s }}</span>
      </div>
    </div>
    <div v-if="diff.status === 'pending'" class="flex gap-2 bg-bg-home px-3 py-2.5">
      <PButton variant="primary" size="md" class="flex-1" :loading="busy" @click="$emit('apply')">{{
        t('ai.diff.apply')
      }}</PButton>
      <PButton variant="outline" size="md" :disabled="busy" @click="$emit('discard')">{{
        t('ai.diff.discard')
      }}</PButton>
    </div>
  </div>
</template>
