<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { useSessionStore } from '@/stores/session'
import ProfileMenu from '@/components/shell/ProfileMenu.vue'
import ShortcutsDialog from '@/components/shell/ShortcutsDialog.vue'

const session = useSessionStore()
</script>

<template>
  <div class="flex h-full flex-col overflow-auto bg-bg-home">
    <header
      class="sticky top-0 z-20 flex h-[60px] shrink-0 items-center gap-3 border-b border-line-soft bg-surface px-6"
    >
      <RouterLink
        to="/"
        class="grid size-[30px] place-items-center rounded-[9px] bg-ink text-xl font-extrabold text-on-ink"
        >P</RouterLink
      >
      <RouterLink to="/" class="text-xl font-bold">Platon AI Studio</RouterLink>
      <span class="mx-1 h-5 w-px bg-line" />
      <span class="flex items-center gap-1.5 text-md font-medium text-fg-2"
        >{{ session.session?.organization.name ?? '…' }}<ChevronDown :size="14"
      /></span>
      <div class="ml-auto flex items-center gap-2.5"><ProfileMenu /></div>
    </header>
    <RouterView />
    <ShortcutsDialog />
  </div>
</template>
