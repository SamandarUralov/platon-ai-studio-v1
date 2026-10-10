<script setup lang="ts">
import { Construction } from 'lucide-vue-next'
import { PEmptyState } from '@platon/ui'

defineProps<{ title: string; phase: string }>()
</script>

<template>
  <div class="grid h-full place-items-center bg-bg">
    <PEmptyState :icon="Construction" :title="title" :description="`Being built in ${phase}.`" />
  </div>
</template>
