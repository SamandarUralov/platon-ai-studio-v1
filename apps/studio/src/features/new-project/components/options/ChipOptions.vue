<script setup lang="ts">
import { toRef } from 'vue'
import { Check } from 'lucide-vue-next'
import { cn } from '@platon/ui'
import type { GroupDef } from '../../catalog'
import { useAnswerText } from '../../useAnswerText'
import { useGroup } from './useGroup'

const props = defineProps<{ group: GroupDef; label: string }>()
const { flow, selected, pick, role } = useGroup(toRef(props, 'group'))
const { optionLabel } = useAnswerText(flow)
</script>

<template>
  <div class="flex flex-wrap gap-2" :role="group.multi ? 'group' : 'radiogroup'" :aria-label="label">
    <button
      v-for="o in group.options"
      :key="o.id"
      type="button"
      data-option
      :role="role"
      :aria-checked="selected(o.id)"
      :class="
        cn(
          'flex h-[38px] items-center gap-[7px] rounded-full border-[1.5px] px-[15px] text-md font-semibold transition-colors',
          selected(o.id)
            ? 'border-ink bg-ink text-on-ink'
            : 'border-line bg-surface text-fg-2 hover:border-faint-2',
        )
      "
      @click="pick(o.id)"
    >
      <Check v-if="selected(o.id)" :size="13" :stroke-width="2.5" aria-hidden="true" />{{
        optionLabel(group.ns, o.id)
      }}
    </button>
  </div>
</template>
