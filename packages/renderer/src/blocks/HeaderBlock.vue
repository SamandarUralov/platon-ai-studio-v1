<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import { type BlockProps, str, tr, useResolved } from './props'

const props = defineProps<BlockProps>()
const emit = defineEmits<{ event: [name: string, arg?: unknown] }>()
const r = useResolved(props)
const label = computed(() => str(r.value.buttonLabel))
/** Main button audience: everyone | staff (non-customer roles) | role id. */
const showButton = computed(() => {
  if (!label.value) return false
  const who = str(r.value.buttonWho, 'everyone')
  const role = props.ctx.viewer?.role
  if (!role || who === 'everyone') return true
  if (who === 'staff') return role === 'admin' || role === 'dispatcher'
  if (who === 'nobody') return false
  return who === role
})
</script>

<template>
  <div class="flex flex-wrap items-start gap-4">
    <div class="min-w-0 flex-1">
      <h1 class="m-0 text-[1.6em] leading-tight font-bold tracking-tight">
        {{ tr(props, 'title', r.title ?? '') }}
      </h1>
      <p v-if="r.subtitle" class="mt-1 mb-0 text-[0.93em] text-(--app-muted)">
        {{ tr(props, 'subtitle', str(r.subtitle)) }}
      </p>
    </div>
    <button
      v-if="showButton"
      type="button"
      class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-(--app-radius) bg-(--app-accent) px-3.5 text-[13px] font-bold text-(--app-accent-fg) hover:opacity-90 disabled:opacity-50"
      :disabled="r.buttonDisabled === true || r.disabled === true"
      @click.stop="emit('event', 'buttonClick', { label })"
    >
      <Plus :size="15" />{{ tr(props, 'buttonLabel', label) }}
    </button>
  </div>
</template>
