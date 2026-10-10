<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@platon/ui'
import { useSessionStore } from '@/stores/session'

const props = defineProps<{ name: string; hex: string; mode: string; radius: string }>()
const { t } = useI18n()
const session = useSessionStore()

// Scoping data-theme on the frame re-uses Studio's light/dark tokens for the generated app's mode.
const theme = computed(() =>
  props.mode === 'system' ? session.resolvedTheme : props.mode === 'dark' ? 'dark' : 'light',
)
const r = computed(
  () =>
    ({ sharp: 'rounded-[3px]', soft: 'rounded-md', round: 'rounded-[11px]' })[props.radius] ?? 'rounded-md',
)
const nav = ['dashboard', 'jobs', 'schedule', 'customers', 'reports'] as const
const brand = computed(() => ({ background: props.hex }))
</script>

<template>
  <div
    :data-theme="theme"
    class="overflow-hidden rounded-[14px] border border-line-soft bg-surface text-fg transition-colors duration-300"
    aria-hidden="true"
  >
    <div class="flex h-[200px]">
      <div
        class="flex w-[88px] shrink-0 flex-col gap-[3px] border-r border-line-soft bg-subtle-2 px-[7px] py-2.5"
      >
        <div class="mb-2 flex items-center gap-[5px]">
          <span
            class="grid size-[18px] shrink-0 place-items-center rounded-[5px] text-[9px] font-extrabold text-white"
            :style="brand"
            >{{ name.charAt(0).toUpperCase() }}</span
          >
          <span class="truncate text-[9.5px] font-bold">{{ name }}</span>
        </div>
        <span
          v-for="(n, i) in nav"
          :key="n"
          :class="
            cn(
              'flex h-[19px] items-center px-1.5 text-[9px] font-semibold',
              r,
              i === 1 ? 'text-white' : 'text-fg-2',
            )
          "
          :style="i === 1 ? brand : undefined"
          >{{ t(`newProject.panel.nav.${n}`) }}</span
        >
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-[7px] p-[11px]">
        <div class="text-[11.5px] font-bold">{{ t('newProject.panel.todayJobs') }}</div>
        <div :class="cn('border border-line-soft bg-surface px-2 py-[7px]', r)">
          <div class="text-[9.5px] font-semibold">{{ t('newProject.panel.job1') }}</div>
          <div class="mt-0.5 text-[8.5px] text-faint">{{ t('newProject.panel.job1Meta') }}</div>
        </div>
        <div :class="cn('border border-line-soft bg-surface px-2 py-[7px]', r)">
          <div class="text-[9.5px] font-semibold">{{ t('newProject.panel.job2') }}</div>
          <div class="mt-0.5 text-[8.5px] text-faint">{{ t('newProject.panel.job2Meta') }}</div>
        </div>
        <div
          :class="cn('mt-auto grid h-[23px] place-items-center text-[9.5px] font-bold text-white', r)"
          :style="brand"
        >
          {{ t('newProject.panel.startNext') }}
        </div>
      </div>
    </div>
  </div>
</template>
