<script setup lang="ts">
/** "Generate test data": adds marked rows to Development only; they never ship with releases. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { ShieldCheck, Sparkles } from 'lucide-vue-next'
import { PButton, PPopover, PSegmented, toast } from '@platon/ui'
import type { Table } from '@platon/definition'
import { errorMessage } from '@/services/http'
import { dataApi, dataKeys } from '../api'
import { useData } from '../composables/useDataModel'

const props = defineProps<{ table: Table }>()
const { t } = useI18n()
const m = useData()
const qc = useQueryClient()
const open = ref(false)
const count = ref<number>(25)
const COUNTS = [10, 25, 50, 100].map((n) => ({ value: n, label: String(n) }))

const fillable = computed(() => props.table.fields.filter((f) => f.type !== 'auto_number').length)
const targets = computed(() => {
  const names = props.table.fields
    .filter((f) => f.type === 'link')
    .map((f) => m.tables.value.find((x) => x.id === f.link)?.name)
    .filter(Boolean)
  return names.length ? names.join(', ') : t('data.gen.records')
})
const testN = computed(() => m.testCount(props.table.id))

const refresh = () => qc.invalidateQueries({ queryKey: dataKeys.all(m.pid.value) })

const gen = useMutation({
  mutationFn: () => dataApi.generate(m.pid.value, props.table.id, count.value),
  onMutate: () => (open.value = false),
  onSuccess: (r) => {
    void refresh()
    toast(t('data.gen.added', { n: r.added }), { tone: 'ok' })
  },
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
})
const remove = useMutation({
  mutationFn: () => dataApi.removeTest(m.pid.value, props.table.id),
  onMutate: () => (open.value = false),
  onSuccess: (r) => {
    void refresh()
    toast(t('data.gen.removed', { n: r.removed }))
  },
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
})
</script>

<template>
  <PPopover v-model:open="open" align="end" :width="300" class="p-3.5">
    <template #trigger>
      <PButton variant="ai" :icon="Sparkles" :loading="gen.isPending.value" class="border-ai/30">
        {{ gen.isPending.value ? t('data.table.generating') : t('data.table.generate') }}
      </PButton>
    </template>
    <div class="flex flex-col gap-3">
      <div>
        <div class="flex items-center gap-1.5 text-md font-bold">
          <Sparkles :size="14" class="text-ai" />{{ t('data.gen.title') }}
        </div>
        <p class="mt-1 text-xs leading-snug text-muted">{{ t('data.gen.note', { n: fillable, targets }) }}</p>
      </div>
      <div>
        <div class="mb-1.5 text-xs font-semibold text-fg-2">{{ t('data.gen.howMany') }}</div>
        <PSegmented v-model="count" :options="COUNTS" block :aria-label="t('data.gen.howMany')" />
      </div>
      <div class="flex gap-2 rounded-[9px] bg-ok-bg px-3 py-2 text-xs leading-snug text-ok">
        <ShieldCheck :size="13" class="mt-px shrink-0" />{{ t('data.gen.devOnly') }}
      </div>
      <PButton variant="ai" size="md" class="w-full border-ai/30" @click="gen.mutate()">{{
        t('data.gen.cta', { n: count })
      }}</PButton>
      <PButton
        v-if="testN"
        variant="ghost"
        size="xs"
        class="text-danger"
        :loading="remove.isPending.value"
        @click="remove.mutate()"
        >{{ t('data.gen.remove', { n: testN }) }}</PButton
      >
    </div>
  </PPopover>
</template>
