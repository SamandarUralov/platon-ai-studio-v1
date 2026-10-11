<script setup lang="ts">
/** A community component in the palette: installs into the project, then adds it to the page. */
import { useI18n } from 'vue-i18n'
import { Download, Plus, Users } from 'lucide-vue-next'
import { PButton } from '@platon/ui'
import type { CommunityComponent } from '@platon/definition'

defineProps<{ component: CommunityComponent; installing: boolean; installed: boolean }>()
const emit = defineEmits<{ add: [] }>()
const { t, n } = useI18n()
</script>

<template>
  <div class="rounded-xl border border-line bg-surface p-2" @dblclick="emit('add')">
    <div class="flex items-center gap-1.5">
      <span class="grid size-6 shrink-0 place-items-center rounded-md bg-teal-bg text-teal"
        ><Users :size="13"
      /></span>
      <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ component.name }}</span>
      <PButton
        size="xs"
        variant="tint"
        :icon="installed ? Plus : Download"
        :loading="installing"
        @click="emit('add')"
        >{{ installed ? t('interface.left.addToPage') : t('interface.left.install') }}</PButton
      >
    </div>
    <p class="mt-1 line-clamp-2 text-sm text-muted">{{ component.description }}</p>
    <div class="mt-1 flex items-center gap-1.5 text-xs text-faint">
      <span class="truncate">{{ component.author }}</span>
      <span>·</span>
      <span class="shrink-0">{{ t('interface.left.installs', { n: n(component.installs) }) }}</span>
    </div>
  </div>
</template>
