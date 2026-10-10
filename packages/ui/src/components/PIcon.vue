<script setup lang="ts">
/**
 * Renders a lucide icon by kebab-case name (e.g. "clipboard-list"), as stored in the app definition.
 * The full icon set is loaded lazily on first use so it never lands in the initial bundle.
 */
import { computed, shallowRef, type Component } from 'vue'

const props = withDefaults(defineProps<{ name?: string | null; size?: number; strokeWidth?: number }>(), {
  size: 16,
  strokeWidth: 2,
})

const registry = shallowRef<Record<string, Component> | null>(cache)
if (!cache) void loadIcons().then((r) => (registry.value = r))

const comp = computed(() => {
  if (!props.name || !registry.value) return null
  return registry.value[toPascal(props.name)] ?? registry.value.Circle ?? null
})
</script>

<script lang="ts">
let cache: Record<string, Component> | null = null
let pending: Promise<Record<string, Component>> | null = null

export function loadIcons(): Promise<Record<string, Component>> {
  pending ??= import('lucide-vue-next').then((m) => (cache = m.icons as unknown as Record<string, Component>))
  return pending
}

export function toPascal(name: string): string {
  return name.replace(/(^|[-_ ])(\w)/g, (_, __, c: string) => c.toUpperCase())
}
</script>

<template>
  <component :is="comp" v-if="comp" :size="size" :stroke-width="strokeWidth" aria-hidden="true" />
  <span v-else class="inline-block shrink-0" :style="{ width: `${size}px`, height: `${size}px` }" />
</template>
