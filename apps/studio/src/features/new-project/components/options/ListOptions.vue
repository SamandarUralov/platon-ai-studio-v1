<script setup lang="ts">
import { toRef } from 'vue'
import { Check } from 'lucide-vue-next'
import { PIcon, cn } from '@platon/ui'
import type { GroupDef } from '../../catalog'
import { useI18n } from 'vue-i18n'
import { useAnswerText } from '../../useAnswerText'
import { useGroup } from './useGroup'

const props = defineProps<{ group: GroupDef; label: string; numbered: boolean }>()
const { flow, selected, pick, role } = useGroup(toRef(props, 'group'))
const { optionLabel } = useAnswerText(flow)
const { t, te } = useI18n()
const desc = (id: string) => {
  const key = `newProject.optDesc.${props.group.ns}.${id}`
  return te(key) ? t(key) : ''
}
</script>

<template>
  <div
    class="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2"
    :role="group.multi ? 'group' : 'radiogroup'"
    :aria-label="label"
  >
    <button
      v-for="(o, i) in group.options"
      :key="o.id"
      type="button"
      data-option
      :role="role"
      :aria-checked="selected(o.id)"
      :aria-keyshortcuts="numbered && i < 9 ? String(i + 1) : undefined"
      :class="
        cn(
          'flex min-h-14 items-center gap-3 rounded-[13px] border-[1.5px] py-2.5 pl-2.5 pr-3.5 text-left transition-colors',
          selected(o.id)
            ? 'border-primary bg-primary-tint/60'
            : 'border-line-2 bg-surface hover:border-primary-ring',
        )
      "
      @click="pick(o.id)"
    >
      <span
        :class="
          cn(
            'grid size-6 shrink-0 place-items-center rounded-[7px] font-mono text-xs font-bold',
            selected(o.id) ? 'bg-primary text-on-accent' : 'bg-subtle text-muted',
          )
        "
        aria-hidden="true"
        >{{ numbered && i < 9 ? i + 1 : '·' }}</span
      >
      <PIcon
        v-if="o.icon"
        :name="o.icon"
        :size="17"
        :class="selected(o.id) ? 'text-primary' : 'text-faint'"
      />
      <span class="min-w-0 flex-1">
        <span class="block text-lg font-semibold">{{ optionLabel(group.ns, o.id) }}</span>
        <span v-if="desc(o.id)" class="mt-px block text-sm leading-snug text-muted">{{ desc(o.id) }}</span>
      </span>
      <span
        :class="
          cn(
            'grid size-5 shrink-0 place-items-center border-[1.5px] text-on-accent',
            group.multi ? 'rounded-md' : 'rounded-full',
            selected(o.id) ? 'border-primary bg-primary' : 'border-line bg-surface',
          )
        "
        aria-hidden="true"
      >
        <Check v-if="selected(o.id)" :size="11" :stroke-width="3" />
      </span>
    </button>
  </div>
</template>
