<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { ENGINES, type DbEngine } from '@platon/definition'
import { PIcon, cn, toneClasses } from '@platon/ui'
import { RECOMMENDED_ENGINE, type GroupDef } from '../../catalog'
import { useGroup } from './useGroup'

const props = defineProps<{ group: GroupDef; label: string }>()
const { selected, pick } = useGroup(toRef(props, 'group'))
const { t } = useI18n()
const eng = (id: string) => ENGINES[id as DbEngine]
</script>

<template>
  <div
    class="grid grid-cols-[repeat(auto-fill,minmax(122px,1fr))] gap-2"
    role="radiogroup"
    :aria-label="label"
  >
    <button
      v-for="o in group.options"
      :key="o.id"
      type="button"
      data-option
      role="radio"
      :aria-checked="selected(o.id)"
      :class="
        cn(
          'relative flex flex-col items-center gap-2 rounded-[13px] border-[1.5px] px-2 pb-3 pt-4 transition-colors',
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
            'grid size-[30px] place-items-center rounded-lg',
            toneClasses[eng(o.id).tone].bg,
            toneClasses[eng(o.id).tone].fg,
          )
        "
      >
        <PIcon :name="o.icon" :size="17" />
      </span>
      <span class="text-base font-semibold">{{ eng(o.id).label }}</span>
      <span
        v-if="o.id === RECOMMENDED_ENGINE"
        class="absolute right-[7px] top-[7px] rounded-md bg-teal-bg px-1.5 py-px text-[10px] font-bold text-teal"
      >
        {{ t('newProject.bestFit') }}
      </span>
    </button>
  </div>
</template>
