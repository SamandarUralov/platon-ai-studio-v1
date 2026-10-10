<script setup lang="ts">
import { toneClasses, cn, type Tone } from '@platon/ui'
import type { FileKind } from '../catalog'

const props = withDefaults(defineProps<{ kind: FileKind; badge: string; small?: boolean }>(), {
  small: false,
})

// Colour-codes attachments by type so a mixed list scans quickly.
const TONE: Record<FileKind, Tone> = {
  doc: 'info',
  pdf: 'danger',
  sheet: 'ok',
  image: 'purple',
  text: 'neutral',
  other: 'neutral',
}
</script>

<template>
  <span
    aria-hidden="true"
    :class="
      cn(
        'grid shrink-0 place-items-center font-extrabold',
        toneClasses[TONE[props.kind]].bg,
        toneClasses[TONE[props.kind]].fg,
        small ? 'size-5 rounded-[5px] text-[7.5px]' : 'size-8 rounded-lg text-[9.5px]',
      )
    "
    >{{ badge }}</span
  >
</template>
