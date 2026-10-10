<script setup lang="ts">
/** Component lifecycle chip: Building · Needs review · Reviewed · Live · Code out of sync. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LoaderCircle } from 'lucide-vue-next'
import { PBadge, type Tone } from '@platon/ui'
import type { CustomComponent } from '@platon/definition'

export type DisplayStatus = CustomComponent['status']

const props = defineProps<{ status: DisplayStatus; size?: 'xs' | 'sm' }>()
const { t } = useI18n()

const TONE: Record<DisplayStatus, Tone> = {
  building: 'ai',
  needs_review: 'warn',
  reviewed: 'primary',
  live: 'ok',
  out_of_sync: 'warn',
}
const tone = computed(() => TONE[props.status])
</script>

<template>
  <PBadge
    :tone="tone"
    :dot="status !== 'building'"
    :icon="status === 'building' ? LoaderCircle : undefined"
    :size="size ?? 'sm'"
  >
    {{ t(`components.status.${status}`) }}
  </PBadge>
</template>
