<script setup lang="ts">
import { computed } from 'vue'
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui'

const props = withDefaults(defineProps<{ min?: number; max?: number; step?: number; label?: string }>(), {
  min: 0,
  max: 100,
  step: 1,
})
const model = defineModel<number>({ default: 0 })
const arr = computed({
  get: () => [model.value],
  set: (v: number[] | undefined) => (model.value = v?.[0] ?? props.min),
})
</script>

<template>
  <SliderRoot
    v-model="arr"
    :min="min"
    :max="max"
    :step="step"
    class="relative flex h-5 w-full touch-none select-none items-center"
  >
    <SliderTrack class="relative h-1 grow rounded-full bg-line">
      <SliderRange class="absolute h-full rounded-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      :aria-label="label"
      class="block size-4 rounded-full border-2 border-primary bg-surface shadow-xs focus:shadow-focus focus:outline-none"
    />
  </SliderRoot>
</template>
