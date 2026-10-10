<script setup lang="ts">
/** Grid of page icons (PAGE_ICONS); first two rows, the rest behind "More". */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PIcon } from '@platon/ui'
import { PAGE_ICONS } from '@platon/definition'

const model = defineModel<string>({ required: true })
const { t } = useI18n()
const all = ref(false)
const icons = computed(() => {
  const base = all.value ? PAGE_ICONS : PAGE_ICONS.slice(0, 15)
  return base.includes(model.value) || !model.value ? base : [model.value, ...base.slice(0, -1)]
})
</script>

<template>
  <div class="grid grid-cols-8 gap-1.5" role="radiogroup" :aria-label="t('interface.page.icon')">
    <button
      v-for="i in icons"
      :key="i"
      type="button"
      role="radio"
      :aria-checked="model === i"
      :title="i"
      class="grid aspect-square place-items-center rounded-lg border"
      :class="
        model === i
          ? 'border-primary bg-primary-tint text-primary-strong'
          : 'border-line text-muted hover:bg-hover hover:text-fg'
      "
      @click="model = i"
    >
      <PIcon :name="i" :size="15" />
    </button>
    <button
      v-if="!all"
      type="button"
      class="grid aspect-square place-items-center rounded-lg border border-dashed border-line text-xs font-semibold text-muted hover:bg-hover"
      :title="t('interface.page.moreIcons')"
      @click="all = true"
    >
      +{{ PAGE_ICONS.length - 15 }}
    </button>
  </div>
</template>
