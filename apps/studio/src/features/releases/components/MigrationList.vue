<script setup lang="ts">
/** Generated SQL migrations (expandable preview) and storage provisioning steps. */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, Cloud, FileCode, Folder, HardDrive, TriangleAlert } from 'lucide-vue-next'
import type { Migration, ProvisioningStep } from '@platon/definition'
import { PBadge } from '@platon/ui'

defineProps<{ migrations: Migration[]; provisioning: ProvisioningStep[]; compact?: boolean }>()
const { t } = useI18n()
const open = ref<Set<string>>(new Set())
function toggle(f: string) {
  const s = new Set(open.value)
  if (s.has(f)) s.delete(f)
  else s.add(f)
  open.value = s
}
const KIND_ICON = { object_storage: HardDrive, bucket: Cloud, folder: Folder }
const ACTION_TONE = { create: 'ok', update: 'warn', remove: 'danger' } as const
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div
      v-for="m in migrations"
      :key="m.file"
      class="overflow-hidden rounded-lg border border-line-2 bg-surface"
    >
      <button
        type="button"
        class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-hover"
        :aria-expanded="open.has(m.file)"
        @click="toggle(m.file)"
      >
        <ChevronRight
          :size="13"
          class="shrink-0 text-faint transition-transform"
          :class="open.has(m.file) && 'rotate-90'"
        />
        <FileCode :size="14" class="shrink-0 text-teal" />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-mono text-sm font-semibold">{{ m.file }}</span>
          <span v-if="!compact" class="block truncate text-xs text-faint"
            >{{ m.summary }} · {{ m.connection }}</span
          >
        </span>
        <PBadge v-if="m.destructive" tone="danger" size="xs" :icon="TriangleAlert">{{
          t('releases.destructive')
        }}</PBadge>
      </button>
      <pre
        v-if="open.has(m.file)"
        class="m-0 overflow-auto border-t border-line-faint bg-code-bg px-3.5 py-2.5 font-mono text-xs leading-relaxed text-code-fg scroll-thin"
        >{{ m.sql }}</pre>
    </div>
    <div
      v-for="p in provisioning"
      :key="p.kind + p.target + p.action"
      class="flex items-center gap-2 rounded-lg border border-line-2 bg-surface px-3 py-2"
    >
      <component :is="KIND_ICON[p.kind]" :size="14" class="shrink-0 text-ok" />
      <span class="min-w-0 flex-1 truncate text-sm">{{ p.summary }}</span>
      <PBadge :tone="ACTION_TONE[p.action]" size="xs">{{ t(`releases.prov.${p.action}`) }}</PBadge>
    </div>
  </div>
</template>
