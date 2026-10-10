<template>
  <span class="inline-flex items-center gap-1" role="status" aria-label="Working">
    <span
      v-for="i in 3"
      :key="i"
      class="size-1.5 rounded-full bg-faint animate-dot"
      :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
    />
  </span>
</template>
