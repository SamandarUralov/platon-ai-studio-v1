<script setup lang="ts">
import { ref } from 'vue'
import { ACCEPTED_FILES } from '../catalog'

const emit = defineEmits<{ files: [files: File[]] }>()
const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
// dragenter/dragleave fire for every child element; a depth counter avoids flicker.
let depth = 0

function hasFiles(e: DragEvent) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
}
function onEnter(e: DragEvent) {
  if (!hasFiles(e)) return
  depth++
  dragging.value = true
}
function onLeave() {
  depth = Math.max(0, depth - 1)
  if (!depth) dragging.value = false
}
function onDrop(e: DragEvent) {
  depth = 0
  dragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) emit('files', files)
}
function onPicked(e: Event) {
  const el = e.target as HTMLInputElement
  const files = Array.from(el.files ?? [])
  if (files.length) emit('files', files)
  el.value = ''
}
const pick = () => input.value?.click()
defineExpose({ pick })
</script>

<template>
  <div @dragenter.prevent="onEnter" @dragover.prevent @dragleave="onLeave" @drop.prevent="onDrop">
    <input
      ref="input"
      type="file"
      multiple
      :accept="ACCEPTED_FILES"
      class="hidden"
      tabindex="-1"
      aria-hidden="true"
      @change="onPicked"
    />
    <slot :dragging="dragging" :pick="pick" />
  </div>
</template>
