<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'
import { PButton } from '@platon/ui'
</script>

<template>
  <div class="grid h-full place-items-center bg-bg-home px-4">
    <div class="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
      <div
        class="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-ink text-lg font-extrabold text-on-ink"
      >
        P
      </div>
      <h1 class="m-0 text-xl font-bold">You’re signed out</h1>
      <p class="mt-1.5 text-base text-muted">Your work is saved. Sign in again to keep building.</p>
      <PButton variant="primary" size="lg" class="mt-6 w-full" :icon="LogIn" @click="$router.push('/')"
        >Sign in</PButton
      >
    </div>
  </div>
</template>
