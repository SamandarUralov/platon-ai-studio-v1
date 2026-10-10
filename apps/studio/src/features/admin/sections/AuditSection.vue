<script setup lang="ts">
/** Audit log: every admin action and sensitive change, newest first, filterable by area and text. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { refDebounced } from '@vueuse/core'
import { useQuery } from '@tanstack/vue-query'
import { Search } from 'lucide-vue-next'
import { PBadge, PInput, PSpinner, cn } from '@platon/ui'
import type { AdminArea, AuditEntry } from '@platon/definition'
import { fmtDate, relTime } from '@/composables/format'
import { http } from '@/services/http'
import AdminCard from '../components/AdminCard.vue'
import { adminKeys } from '../api'

const { t } = useI18n()
const AREAS: AdminArea[] = ['Studio', 'Users', 'Roles', 'Projects', 'AI', 'Databases', 'Sandboxes', 'Modules']
const area = ref<AdminArea | null>(null)
const q = ref('')
const dq = refDebounced(q, 250)

const audit = useQuery({
  queryKey: computed(() => [...adminKeys.audit(area.value), dq.value]),
  queryFn: async () =>
    (
      await http.get<{ items: AuditEntry[] }>('/admin/audit', {
        params: { area: area.value ?? undefined, q: dq.value || undefined },
      })
    ).data.items,
  placeholderData: (prev) => prev,
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      v-for="a in [null, ...AREAS]"
      :key="a ?? 'all'"
      type="button"
      :aria-pressed="area === a"
      :class="
        cn(
          'h-[30px] rounded-full border px-3 text-sm font-semibold',
          area === a ? 'border-ink bg-ink text-on-ink' : 'border-line bg-surface text-fg-2 hover:bg-hover',
        )
      "
      @click="area = a"
    >
      {{ a ? t(`admin.areas.${a}`) : t('admin.audit.all') }}
    </button>
    <PInput
      v-model="q"
      :icon="Search"
      size="sm"
      class="ml-auto w-[220px]"
      :placeholder="t('admin.audit.search')"
      :aria-label="t('admin.audit.search')"
    />
  </div>
  <AdminCard>
    <div v-if="audit.isLoading.value" class="grid place-items-center py-10 text-muted"><PSpinner /></div>
    <div
      v-for="x in audit.data.value ?? []"
      :key="x.id"
      class="flex flex-wrap items-center gap-3 border-b border-line-faint px-4 py-[11px] text-base last:border-b-0"
    >
      <span class="w-[110px] shrink-0 text-xs text-faint" :title="fmtDate(x.at, 'YYYY-MM-DD HH:mm:ss')">{{
        relTime(x.at)
      }}</span>
      <span class="min-w-[200px] flex-1">{{ x.text }}</span>
      <span class="text-xs text-muted">{{ x.who }}</span>
      <PBadge size="xs">{{ t(`admin.areas.${x.area}`) }}</PBadge>
    </div>
    <div v-if="audit.data.value && !audit.data.value.length" class="p-5 text-center text-base text-faint">
      {{ t('admin.audit.none') }}
    </div>
  </AdminCard>
</template>
