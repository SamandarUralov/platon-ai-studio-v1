<script setup lang="ts">
import { CircleCheck, CircleAlert, TriangleAlert, Info, X } from 'lucide-vue-next'
import { useToasts, dismissToast } from '../composables/useToast'

const state = useToasts()
const ICONS = { ok: CircleCheck, danger: CircleAlert, warn: TriangleAlert } as const
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2"
    aria-live="polite"
  >
    <TransitionGroup
      enter-from-class="opacity-0 translate-y-2"
      leave-to-class="opacity-0"
      enter-active-class="transition duration-200"
      leave-active-class="transition duration-150"
    >
      <div
        v-for="t in state.items"
        :key="t.id"
        role="status"
        class="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-ink py-2 pl-3 pr-2 text-base font-medium text-on-ink shadow-pop"
      >
        <component
          :is="ICONS[t.tone as keyof typeof ICONS] ?? Info"
          :size="15"
          :class="
            t.tone === 'ok'
              ? 'text-ok-dot'
              : t.tone === 'danger'
                ? 'text-danger-dot'
                : t.tone === 'warn'
                  ? 'text-warn-dot'
                  : 'opacity-70'
          "
        />
        <span>{{ t.text }}</span>
        <button
          v-if="t.action"
          class="ml-1 rounded-md px-2 py-0.5 font-bold text-primary-ring hover:bg-white/10"
          @click="
            t.action.run()
            dismissToast(t.id)
          "
        >
          {{ t.action.label }}
        </button>
        <button
          class="grid size-6 place-items-center rounded-md opacity-60 hover:opacity-100"
          aria-label="Dismiss"
          @click="dismissToast(t.id)"
        >
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
