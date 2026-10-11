<script setup lang="ts">
/** Text, image, button, divider, badge, spacer, breadcrumb and empty state. */
import { computed } from 'vue'
import { ChevronRight, Image as ImageIcon } from 'lucide-vue-next'
import { PIcon } from '@platon/ui'
import { KitBadge, KitButton, kitVariant } from '../kit'
import { type BlockProps, list, str, tr, useResolved } from './props'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const src = computed(() => {
  const s = str(r.value.src)
  return /^(https?:|data:image\/)/.test(s) ? s : ''
})
// Blocks saved before the kit used variant "outline"; map it onto the kit's outlined primary button.
const buttonVariant = computed(() => kitVariant(r.value.variant))
const outlined = computed(() => r.value.outlined === true || r.value.variant === 'outline')
const SIZES = ['small-x', 'small', 'medium', 'large', 'large-x']
const buttonSize = computed(() => (SIZES.includes(str(r.value.size)) ? str(r.value.size) : 'medium'))
const badgeSize = computed(() => (['sm', 'md', 'lg'].includes(str(r.value.size)) ? str(r.value.size) : 'md'))
const spacer = computed(() => Math.min(240, Math.max(4, Number(r.value.size) || 24)))
const crumbs = computed(() => {
  const l = list(r.value.items)
  return l.length ? l : ['Home', 'Work orders', 'WO-1042']
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
  <div v-else-if="block.type === 'button'" class="pk">
    <KitButton
      :variant="buttonVariant"
      :outlined="outlined"
      :size="buttonSize"
      :disabled="r.disabled === true"
      :badge-content="str(r.badge) || undefined"
      @click.stop="emit('event', 'click')"
    >
      {{ tr(props, 'label', str(r.label, r.title ?? 'Button')) }}
    </KitButton>
  </div>
  <div v-else-if="block.type === 'badge'" class="pk">
    <KitBadge
      :variant="kitVariant(r.variant)"
      :size="badgeSize"
      class="cursor-default"
      @click.stop="emit('event', 'click')"
    >
      {{ tr(props, 'text', str(r.text, 'New')) }}
    </KitBadge>
  </div>
  <div v-else-if="block.type === 'spacer'" :style="{ height: `${spacer}px` }" aria-hidden="true" />
  <nav v-else-if="block.type === 'breadcrumb'" aria-label="Breadcrumb" class="text-[13px]">
    <ol class="m-0 flex list-none flex-wrap items-center gap-1 p-0">
      <li v-for="(c, i) in crumbs" :key="i" class="flex items-center gap-1">
        <ChevronRight v-if="i" :size="13" class="text-(--app-faint)" />
        <span v-if="i === crumbs.length - 1" aria-current="page" class="font-semibold text-(--app-fg)">{{
          c
        }}</span>
        <button
          v-else
          type="button"
          class="text-(--app-muted) hover:text-(--app-accent) hover:underline"
          @click.stop="emit('event', 'click', { index: i, label: c })"
        >
          {{ c }}
        </button>
      </li>
    </ol>
  </nav>
  <div
    v-else-if="block.type === 'empty'"
    class="flex flex-col items-center gap-2 rounded-(--app-radius-lg) border border-dashed border-(--app-line) px-6 py-10 text-center"
  >
    <span class="grid size-11 place-items-center rounded-full bg-(--app-accent-tint) text-(--app-accent)">
      <PIcon :name="str(r.icon, 'inbox')" :size="20" />
    </span>
    <span class="text-[14px] font-bold">{{ tr(props, 'title', r.title ?? 'Nothing here yet') }}</span>
    <span class="max-w-sm text-[12.5px] text-(--app-muted)">{{
      tr(props, 'text', str(r.text, 'Create the first one to get started.'))
    }}</span>
    <div v-if="r.buttonLabel" class="pk mt-2">
      <KitButton size="small" @click.stop="emit('event', 'buttonClick')">
        {{ tr(props, 'buttonLabel', str(r.buttonLabel)) }}
      </KitButton>
    </div>
  </div>
  <hr v-else class="my-1 border-0 border-t border-(--app-line)" />
</template>
