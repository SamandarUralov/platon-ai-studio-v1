<script setup lang="ts">
import { watch } from 'vue'
import { TooltipProvider } from 'reka-ui'
import { PToaster } from '@platon/ui'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const { locale } = useI18n()
watch(
  () => session.studioLanguage,
  (l) => (locale.value = l),
  { immediate: true },
)
void session.load()
</script>

<template>
  <TooltipProvider :delay-duration="350">
    <RouterView />
    <PToaster />
  </TooltipProvider>
</template>
