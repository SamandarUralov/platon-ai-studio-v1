<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Tag } from 'lucide-vue-next'
import { cn } from '@platon/ui'
import type { AiNaming } from '@platon/definition'

const props = defineProps<{ naming: AiNaming; disabled?: boolean }>()
defineEmits<{ pick: [name: string] }>()
const { t } = useI18n()

const pending = computed(() => props.naming.status === 'pending')
const options = computed(() =>
  props.naming.picked && !props.naming.options.includes(props.naming.picked)
    ? [...props.naming.options, props.naming.picked]
    : props.naming.options,
)
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line bg-surface">
    <div class="flex min-w-0 items-center gap-2 border-b border-line-faint px-3 py-2.5">
      <Tag :size="14" class="shrink-0 text-purple" />
      <span class="text-sm font-bold whitespace-nowrap text-fg">{{ t(`ai.naming.${naming.kind}`) }}</span>
      <span class="ml-auto min-w-0 truncate font-mono text-2xs text-faint"
        >src/{{ naming.folder }}/{{ naming.picked ?? '…' }}.vue</span
      >
    </div>
    <div class="flex flex-wrap gap-1.5 px-3 py-2.5">
      <button
        v-for="n in options"
        :key="n"
        type="button"
        :disabled="!pending || disabled"
        :aria-pressed="naming.picked === n"
        :class="
          cn(
            'flex h-[30px] items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 font-mono text-sm font-semibold transition-colors',
            naming.picked === n ? 'border-primary bg-primary-tint/50 text-fg' : 'border-line bg-surface',
            pending ? 'text-fg hover:border-primary-ring' : naming.picked !== n && 'text-faint',
            !pending && 'cursor-default',
          )
        "
        @click="$emit('pick', n)"
      >
        <Check v-if="naming.picked === n" :size="13" class="text-primary" />{{ n }}
      </button>
    </div>
    <div class="px-3 pb-3 text-xs leading-snug text-faint">
      {{ pending ? t('ai.naming.hint') : t('ai.naming.using', { name: naming.picked }) }}
    </div>
  </div>
</template>
