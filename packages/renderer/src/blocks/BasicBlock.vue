<script setup lang="ts">
/** Text, image, button and divider. */
import { computed } from 'vue'
import { Image as ImageIcon } from 'lucide-vue-next'
import { type BlockProps, str, tr, useResolved } from './props'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const src = computed(() => {
  const s = str(r.value.src)
  return /^(https?:|data:image\/)/.test(s) ? s : ''
})
</script>

<template>
  <p
    v-if="block.type === 'text'"
    class="m-0 text-[0.93em] leading-relaxed whitespace-pre-line text-(--app-fg-2)"
  >
    {{ tr(props, 'text', str(r.text, 'Add some text…')) }}
  </p>
  <figure v-else-if="block.type === 'image'" class="m-0" @click="emit('event', 'click')">
    <img
      v-if="src"
      :src="src"
      :alt="r.title ?? ''"
      class="block max-h-80 w-full rounded-(--app-radius-lg) object-cover"
    />
    <div
      v-else
      class="grid h-40 place-items-center rounded-(--app-radius-lg) border border-dashed border-(--app-line) bg-(--app-subtle) text-(--app-faint)"
    >
      <ImageIcon :size="28" />
    </div>
    <figcaption v-if="r.title" class="mt-2 text-[12.5px] text-(--app-muted)">
      {{ tr(props, 'title', r.title) }}
    </figcaption>
  </figure>
  <div v-else-if="block.type === 'button'">
    <button
      type="button"
      class="inline-flex h-9 items-center rounded-(--app-radius) px-4 text-[13px] font-bold disabled:opacity-50"
      :class="
        r.variant === 'outline'
          ? 'border border-(--app-line) bg-(--app-surface) text-(--app-fg)'
          : 'bg-(--app-accent) text-(--app-accent-fg) hover:opacity-90'
      "
      :disabled="r.disabled === true"
      @click.stop="emit('event', 'click')"
    >
      {{ tr(props, 'label', str(r.label, r.title ?? 'Button')) }}
    </button>
  </div>
  <hr v-else class="my-1 border-0 border-t border-(--app-line)" />
</template>
