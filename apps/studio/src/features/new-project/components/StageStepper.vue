<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'
import { cn } from '@platon/ui'

const props = defineProps<{ current: number; done: boolean }>()
const { t } = useI18n()

const stages = computed(() =>
  (['describe', 'questions', 'review', 'create'] as const).map((id, i) => {
    const complete = i < props.current || props.done
    const cur = (i === props.current && !props.done) || (props.done && i === 3)
    return {
      id,
      label: t(`newProject.stages.${id}`),
      complete,
      cur,
      active: i === props.current && !props.done,
    }
  }),
)
</script>

<template>
  <ol class="flex min-w-0 items-center gap-1.5 overflow-hidden" :aria-label="t('newProject.stepper')">
    <li v-for="(g, i) in stages" :key="g.id" class="flex items-center gap-1.5">
      <span
        :title="g.label"
        :aria-current="g.cur ? 'step' : undefined"
        :class="
          cn(
            'flex h-7 items-center gap-[7px] whitespace-nowrap rounded-full px-1.5 text-sm font-semibold',
            g.active ? 'bg-primary-tint text-primary-strong' : g.complete ? 'text-fg' : 'text-faint-2',
          )
        "
      >
        <span
          :class="
            cn(
              'grid size-[18px] shrink-0 place-items-center rounded-full text-[10.5px] font-extrabold',
              g.active
                ? 'bg-primary text-on-accent'
                : g.complete
                  ? 'bg-ink text-on-ink'
                  : 'bg-subtle text-faint',
            )
          "
        >
          <Check v-if="g.complete" :size="11" :stroke-width="3" aria-hidden="true" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span v-if="g.cur" class="pr-1.5">{{ g.label }}</span>
        <span v-else class="sr-only">{{ g.label }}</span>
      </span>
      <span v-if="i < stages.length - 1" class="h-[1.5px] w-3.5 bg-line" aria-hidden="true" />
    </li>
  </ol>
</template>
