<script setup lang="ts">
/** Problems from validators, grouped by severity. Emits `select` so the host can jump to the item/line. */
import { computed } from 'vue'
import { CircleAlert, TriangleAlert, Info, CircleCheck } from 'lucide-vue-next'
import type { Problem } from '@platon/definition'

const props = withDefaults(
  defineProps<{ problems: Problem[]; dark?: boolean; emptyText?: string; showPath?: boolean }>(),
  {
    emptyText: 'No problems',
  },
)
const emit = defineEmits<{ select: [p: Problem] }>()
const ORDER = { error: 0, warning: 1, info: 2 } as const
const sorted = computed(() => [...props.problems].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]))
const ICON = { error: CircleAlert, warning: TriangleAlert, info: Info }
</script>

<template>
  <div
    v-if="!problems.length"
    class="flex items-center gap-2 px-3 py-3 text-sm"
    :class="dark ? 'text-code-muted' : 'text-faint'"
  >
    <CircleCheck :size="14" class="text-ok-dot" />{{ emptyText }}
  </div>
  <ul v-else class="m-0 list-none p-1">
    <li v-for="(p, i) in sorted" :key="i">
      <button
        type="button"
        class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm"
        :class="dark ? 'hover:bg-code-line' : 'hover:bg-hover'"
        @click="emit('select', p)"
      >
        <component
          :is="ICON[p.severity]"
          :size="14"
          class="mt-0.5 shrink-0"
          :class="
            p.severity === 'error'
              ? 'text-danger-dot'
              : p.severity === 'warning'
                ? 'text-warn-dot'
                : 'text-info'
          "
        />
        <span class="min-w-0 flex-1">
          <span :class="dark ? 'text-code-fg' : 'text-fg'">{{ p.message }}</span>
          <span
            v-if="p.line"
            class="ml-1.5 font-mono text-xs"
            :class="dark ? 'text-code-muted' : 'text-faint'"
            >line {{ p.line }}</span
          >
          <span
            v-if="showPath"
            class="block truncate font-mono text-2xs"
            :class="dark ? 'text-code-muted' : 'text-faint'"
            >{{ p.path }}</span
          >
        </span>
      </button>
    </li>
  </ul>
</template>
