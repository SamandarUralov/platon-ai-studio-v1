<script setup lang="ts">
import { toRef } from 'vue'
import { Check } from 'lucide-vue-next'
import { cn } from '@platon/ui'
import { brandHex, type GroupDef } from '../../catalog'
import { useAnswerText } from '../../useAnswerText'
import { useGroup } from './useGroup'

const props = defineProps<{ group: GroupDef; label: string }>()
const { flow, selected, pick } = useGroup(toRef(props, 'group'))
const { optionLabel } = useAnswerText(flow)
</script>

<template>
  <div class="flex flex-wrap gap-2.5" role="radiogroup" :aria-label="label">
    <!-- Swatch colours are the app's brand options (user data), hence inline styles. -->
    <button
      v-for="o in group.options"
      :key="o.id"
      type="button"
      data-option
      role="radio"
      :aria-checked="selected(o.id)"
      :class="
        cn(
          'flex h-11 items-center gap-[9px] rounded-xl border-[1.5px] bg-surface pl-[7px] pr-3.5 text-md font-semibold',
          !selected(o.id) && 'border-line-2 hover:border-faint-2',
        )
      "
      :style="selected(o.id) ? { borderColor: brandHex(o.id) } : undefined"
      @click="pick(o.id)"
    >
      <span
        class="grid size-[30px] place-items-center rounded-[9px] text-white"
        :style="{ background: brandHex(o.id) }"
      >
        <Check v-if="selected(o.id)" :size="14" :stroke-width="3" aria-hidden="true" />
      </span>
      {{ optionLabel(group.ns, o.id) }}
    </button>
  </div>
</template>
