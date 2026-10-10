<script setup lang="ts">
/** Response caching for GET APIs: on/off, TTL and which query params vary the cache. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, DatabaseZap, Trash } from 'lucide-vue-next'
import type { Api } from '@platon/definition'
import { cn, PButton, PField, PSelect, PSwitch, toast } from '@platon/ui'

const props = defineProps<{ api: Api }>()
const emit = defineEmits<{ edit: [fn: (a: Api) => Api] }>()
const { t } = useI18n()

const TTLS = ['10 s', '30 s', '1 min', '5 min', '15 min', '1 h', '1 day'].map((x) => ({ value: x, label: x }))
const cacheable = computed(() => props.api.protocol === 'rest' && props.api.method === 'GET')
const cache = computed(() => props.api.cache ?? { enabled: false, ttl: '30 s', varyBy: [] })
const params = computed(() => [...props.api.request.path, ...props.api.request.query].map((f) => f.name))

function set(patch: Partial<NonNullable<Api['cache']>>) {
  emit('edit', (a) => ({ ...a, cache: { ...cache.value, ...patch } }))
}
function toggleVary(n: string) {
  const v = cache.value.varyBy ?? []
  set({ varyBy: v.includes(n) ? v.filter((x) => x !== n) : [...v, n] })
}
</script>

<template>
  <div class="flex flex-col gap-4 px-4 py-4">
    <div class="flex items-start gap-3">
      <DatabaseZap :size="18" class="mt-0.5 text-primary" />
      <div class="min-w-0 flex-1">
        <div class="text-md font-bold">{{ t('logic.cache.title') }}</div>
        <div class="text-sm text-muted">{{ t('logic.cache.desc') }}</div>
      </div>
      <PSwitch
        :model-value="cacheable && cache.enabled"
        :disabled="!cacheable"
        :label="t('logic.cache.title')"
        @update:model-value="set({ enabled: $event })"
      />
    </div>
    <p v-if="!cacheable" class="rounded-lg bg-subtle px-3 py-2 text-sm text-muted">
      {{
        t('logic.cache.notGet', { method: api.protocol === 'rest' ? api.method : api.protocol.toUpperCase() })
      }}
    </p>
    <template v-else-if="cache.enabled">
      <PField :label="t('logic.cache.ttl')" :hint="t('logic.cache.ttlHint')">
        <PSelect
          :model-value="cache.ttl ?? '30 s'"
          :options="TTLS"
          @update:model-value="set({ ttl: $event })"
        />
      </PField>
      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-fg-2">{{ t('logic.cache.vary') }}</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="n in params"
            :key="n"
            type="button"
            :class="
              cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold',
                cache.varyBy?.includes(n)
                  ? 'border-primary-ring bg-primary-tint text-primary-strong'
                  : 'border-line text-muted hover:bg-hover',
              )
            "
            @click="toggleVary(n)"
          >
            <Check v-if="cache.varyBy?.includes(n)" :size="11" />{{ n }}
          </button>
          <span v-if="!params.length" class="text-sm text-faint">{{ t('logic.cache.noParams') }}</span>
        </div>
        <span class="text-xs text-faint">{{ t('logic.cache.varyHint') }}</span>
      </div>
      <p class="rounded-lg bg-subtle px-3 py-2 text-sm text-fg-2">
        {{
          t('logic.cache.summary', {
            ttl: cache.ttl ?? '30 s',
            vary: (cache.varyBy ?? []).join(', ') || t('logic.cache.nothing'),
          })
        }}
      </p>
      <PButton
        class="self-start"
        variant="danger"
        :icon="Trash"
        @click="toast(t('logic.cache.purged'), { tone: 'ok' })"
        >{{ t('logic.cache.purge') }}</PButton
      >
    </template>
  </div>
</template>
