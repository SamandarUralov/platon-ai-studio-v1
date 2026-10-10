<script setup lang="ts">
import { MapPinOff } from 'lucide-vue-next'
import { PButton, PEmptyState } from '@platon/ui'
</script>

<template>
  <div class="grid h-full place-items-center bg-bg-home">
    <PEmptyState
      :icon="MapPinOff"
      title="This page doesn’t exist"
      description="The link may be old, or the item was deleted."
    >
      <PButton variant="ink" @click="$router.push('/')">Go to all apps</PButton>
    </PEmptyState>
  </div>
</template>
