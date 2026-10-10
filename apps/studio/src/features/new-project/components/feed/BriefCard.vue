<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { cn } from '@platon/ui'
import { useFlow } from '../../flow'
import { useAnswerText } from '../../useAnswerText'

const flow = useFlow()
const { t } = useAnswerText(flow)
const s = flow.state
</script>

<template>
  <div class="overflow-hidden rounded-[14px] border border-line-2 bg-surface">
    <div class="border-b border-line-faint px-[18px] py-4">
      <div class="mb-1 text-sm font-bold text-faint">{{ t('newProject.feed.purpose') }}</div>
      <div class="text-[14.5px] font-medium leading-normal">{{ s.brief?.purpose }}</div>
    </div>
    <div class="flex items-center gap-2 px-[18px] pb-1.5 pt-3.5">
      <div id="np-reqs" class="text-sm font-bold text-faint">{{ t('newProject.feed.requirements') }}</div>
      <span class="text-sm text-faint-2">{{
        t('newProject.feed.inScope', { on: flow.inScope.value, total: s.reqs.length })
      }}</span>
    </div>
    <ul class="px-2.5 pb-2.5" aria-labelledby="np-reqs">
      <li v-for="r in s.reqs" :key="r.id">
        <button
          type="button"
          data-option
          role="checkbox"
          :aria-checked="r.on"
          :disabled="flow.locked.value"
          class="flex w-full items-start gap-[11px] rounded-[9px] p-2 text-left enabled:hover:bg-subtle-2 disabled:cursor-default"
          @click="flow.toggleRequirement(r.id)"
        >
          <span
            :class="
              cn(
                'mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] text-on-accent',
                r.on ? 'border-primary bg-primary' : 'border-line bg-surface',
              )
            "
          >
            <Check v-if="r.on" :size="11" :stroke-width="3" aria-hidden="true" />
          </span>
          <span
            :class="cn('flex-1 text-md leading-normal', r.on ? 'text-fg' : 'text-faint-2 line-through')"
            >{{ r.text }}</span
          >
        </button>
      </li>
    </ul>
  </div>
</template>
