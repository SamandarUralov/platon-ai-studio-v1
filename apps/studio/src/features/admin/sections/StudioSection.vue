<script setup lang="ts">
/** Studio settings: name, address, defaults and outgoing email for the whole Studio. Saved per field on blur. */
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PField, PInput, PSelect, PSpinner, type SelectOption } from '@platon/ui'
import type { AdminStudioSettings } from '@platon/definition'
import { http } from '@/services/http'
import AdminCard from '../components/AdminCard.vue'
import { adminKeys, useAdminMutation, useStudio } from '../api'

const { t } = useI18n()
const studio = useStudio()
const form = reactive<AdminStudioSettings>({
  name: '',
  url: '',
  language: 'en',
  timezone: 'UTC',
  smtp: '',
  from: '',
  support: '',
})
watch(
  () => studio.data.value,
  (s) => s && Object.assign(form, s),
  { immediate: true },
)

const save = useAdminMutation(
  async (b: Partial<AdminStudioSettings>) => (await http.patch<AdminStudioSettings>('/admin/studio', b)).data,
  {
    key: adminKeys.studio,
    success: () => t('admin.studio.saved'),
  },
)
function commit(k: keyof AdminStudioSettings) {
  const cur = studio.data.value?.[k]
  if (cur === undefined || form[k].trim() === cur) return
  save.mutate({ [k]: form[k].trim() }, { onError: () => (form[k] = cur) })
}

const TEXT: { key: keyof AdminStudioSettings; mono?: boolean }[] = [
  { key: 'name' },
  { key: 'url', mono: true },
  { key: 'smtp', mono: true },
  { key: 'from', mono: true },
  { key: 'support', mono: true },
]
const langOptions = computed<SelectOption<string>[]>(() => [
  { value: 'en', label: 'English' },
  { value: 'uz', label: 'Oʻzbekcha' },
  { value: 'ru', label: 'Русский' },
])
const tzOptions: SelectOption<string>[] = [
  'Asia/Tashkent',
  'UTC',
  'Europe/London',
  'Europe/Moscow',
  'America/Los_Angeles',
].map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))
function setSelect(k: 'language' | 'timezone', v: string | undefined) {
  if (!v) return
  form[k] = v
  commit(k)
}
</script>

<template>
  <div v-if="studio.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <AdminCard v-else body-class="grid grid-cols-2 gap-4 p-5 max-[760px]:grid-cols-1">
    <PField
      v-for="f in TEXT.slice(0, 2)"
      :key="f.key"
      v-slot="{ id }"
      :label="t(`admin.studio.${f.key}`)"
      :hint="t(`admin.studio.${f.key}Hint`)"
    >
      <PInput
        :id="id"
        v-model="form[f.key]"
        :mono="f.mono"
        @blur="commit(f.key)"
        @keydown.enter="commit(f.key)"
      />
    </PField>
    <PField :label="t('admin.studio.language')" :hint="t('admin.studio.languageHint')">
      <PSelect
        :model-value="form.language"
        :options="langOptions"
        :aria-label="t('admin.studio.language')"
        @update:model-value="(v) => setSelect('language', v)"
      />
    </PField>
    <PField :label="t('admin.studio.timezone')" :hint="t('admin.studio.timezoneHint')">
      <PSelect
        :model-value="form.timezone"
        :options="tzOptions"
        :aria-label="t('admin.studio.timezone')"
        @update:model-value="(v) => setSelect('timezone', v)"
      />
    </PField>
    <PField
      v-for="f in TEXT.slice(2)"
      :key="f.key"
      v-slot="{ id }"
      :label="t(`admin.studio.${f.key}`)"
      :hint="t(`admin.studio.${f.key}Hint`)"
    >
      <PInput
        :id="id"
        v-model="form[f.key]"
        :mono="f.mono"
        @blur="commit(f.key)"
        @keydown.enter="commit(f.key)"
      />
    </PField>
  </AdminCard>
</template>
