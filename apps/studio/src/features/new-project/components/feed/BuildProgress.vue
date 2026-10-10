<script setup lang="ts">
import { computed } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { PSpinner, cn } from '@platon/ui'
import { BUILD_TASKS, useFlow } from '../../flow'
import { useAnswerText } from '../../useAnswerText'

const flow = useFlow()
const { t, taskDetail } = useAnswerText(flow)
const s = flow.state

const tasks = computed(() =>
  BUILD_TASKS.map((id, i) => {
    const done = i < s.gen
    const active = i === s.gen && s.phase !== 'done'
    return {
      id,
      label: t(`newProject.tasks.${id}`),
      detail: taskDetail(id),
      done,
      active,
      failed: active && !!s.buildError,
      pending: i > s.gen,
    }
  }),
)
</script>

<template>
  <ol class="rounded-[14px] border border-line-2 bg-surface px-1.5 py-2" aria-live="polite">
    <li
      v-for="tk in tasks"
      :key="tk.id"
      :class="
        cn('flex items-center gap-3 px-3 py-2 transition-opacity duration-300', tk.pending && 'opacity-40')
      "
      :aria-current="tk.active ? 'step' : undefined"
    >
      <span
        :class="
          cn(
            'grid size-[22px] shrink-0 place-items-center rounded-full',
            tk.done
              ? 'bg-teal-bg text-teal'
              : tk.failed
                ? 'bg-danger-bg text-danger'
                : tk.active
                  ? 'bg-primary-tint text-primary'
                  : 'bg-subtle',
          )
        "
      >
        <Check v-if="tk.done" :size="12" :stroke-width="3" aria-hidden="true" />
        <X v-else-if="tk.failed" :size="12" :stroke-width="3" aria-hidden="true" />
        <PSpinner v-else-if="tk.active" :size="12" />
      </span>
      <span class="text-md font-semibold">{{ tk.label }}</span>
      <span class="ml-auto max-w-[50%] truncate text-sm text-faint" :title="tk.detail">{{ tk.detail }}</span>
    </li>
  </ol>
</template>
