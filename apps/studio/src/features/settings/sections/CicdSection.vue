<script setup lang="ts">
/** CI/CD: release pipeline stages, trigger, run history (polled while running), variables and write-only secrets. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  KeyRound,
  Loader,
  Play,
  Plus,
  Trash2,
  Variable,
} from 'lucide-vue-next'
import {
  PBadge,
  PButton,
  PIcon,
  PInput,
  PSelect,
  PSpinner,
  PSwitch,
  cn,
  type SelectOption,
  type Tone,
} from '@platon/ui'
import type { CiResponse, CiRunStatus, CiStageId, CiTrigger, PutCiVariableRequest } from '@platon/definition'
import { useProjectId } from '@/composables/useProject'
import { relTime } from '@/composables/format'
import { http } from '@/services/http'
import SettingsCard from '../components/SettingsCard.vue'
import SecretField from '../components/SecretField.vue'
import { settingsKeys, useCi, useResourceMutation } from '../api'
import { CI_STAGES } from '../catalog'

const { t } = useI18n()
const pid = useProjectId()
const ci = useCi(pid)
const key = () => settingsKeys.ci(pid.value)

const patch = useResourceMutation(
  key,
  async (b: Partial<CiResponse['config']>) =>
    (await http.patch<CiResponse>(`/projects/${pid.value}/ci`, b)).data,
)
const run = useResourceMutation(
  key,
  async () => (await http.post<CiResponse>(`/projects/${pid.value}/ci/runs`)).data,
  { success: () => t('settings.cicd.started') },
)
const putVar = useResourceMutation(
  key,
  async (v: { key: string; body: PutCiVariableRequest }) =>
    (await http.put<CiResponse>(`/projects/${pid.value}/ci/variables/${v.key}`, v.body)).data,
)
const delVar = useResourceMutation(
  key,
  async (k: string) => (await http.delete<CiResponse>(`/projects/${pid.value}/ci/variables/${k}`)).data,
  { success: (_r, k) => t('settings.cicd.removed', { key: k }) },
)

const triggerOptions = computed<SelectOption<CiTrigger>[]>(() => [
  { value: 'release', label: t('settings.cicd.triggers.release') },
  { value: 'push', label: t('settings.cicd.triggers.push') },
  { value: 'manual', label: t('settings.cicd.triggers.manual') },
])
const trigger = computed({
  get: () => ci.data.value?.config.trigger,
  set: (v: CiTrigger | undefined) => v && patch.mutate({ trigger: v }),
})
const stageOn = (id: CiStageId) => !!ci.data.value?.config.stages[id]
function toggleStage(id: CiStageId, on: boolean) {
  patch.mutate({ stages: { ...ci.data.value!.config.stages, [id]: on } })
}

const STATUS: Record<CiRunStatus, { tone: Tone; icon: typeof CircleCheck }> = {
  passed: { tone: 'ok', icon: CircleCheck },
  failed: { tone: 'danger', icon: CircleX },
  running: { tone: 'primary', icon: Loader },
  waiting: { tone: 'warn', icon: Clock },
}

// ── Variables ───────────────────────────────────────────────────────────────────────
const newKey = ref('')
const newValue = ref('')
const newSecret = ref(false)
const keyError = computed(() =>
  newKey.value && !/^[A-Z][A-Z0-9_]*$/.test(newKey.value) ? t('settings.cicd.keyInvalid') : null,
)
function addVar() {
  if (!newKey.value || keyError.value) return
  if (ci.data.value?.variables.some((v) => v.key === newKey.value)) return
  putVar.mutate(
    { key: newKey.value, body: { secret: newSecret.value, value: newValue.value } },
    { onSuccess: () => ((newKey.value = ''), (newValue.value = ''), (newSecret.value = false)) },
  )
}
const plainDrafts = ref<Record<string, string>>({})
function savePlain(k: string, current?: string) {
  const v = plainDrafts.value[k]
  if (v === undefined || v === current) return
  putVar.mutate({ key: k, body: { secret: false, value: v } })
}
</script>

<template>
  <div v-if="ci.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <template v-else-if="ci.data.value">
    <SettingsCard body-class="flex flex-col gap-4 px-5 py-[18px]">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-xl font-bold">{{ t('settings.cicd.pipeline') }}</h2>
        <label class="ml-auto flex items-center gap-2 text-sm font-semibold text-fg-2">
          {{ t('settings.cicd.runs') }}
          <PSelect
            v-model="trigger"
            :options="triggerOptions"
            size="sm"
            class="w-[190px]"
            :aria-label="t('settings.cicd.trigger')"
          />
        </label>
        <PButton
          variant="primary"
          :icon="Play"
          :loading="run.isPending.value"
          @click="run.mutate(undefined)"
          >{{ t('settings.cicd.runNow') }}</PButton
        >
      </div>
      <div class="flex items-stretch gap-2 overflow-x-auto pb-1 scroll-thin">
        <template v-for="(s, i) in CI_STAGES" :key="s.id">
          <div
            :class="
              cn(
                'flex min-w-[150px] flex-1 flex-col rounded-[11px] border p-3 transition-opacity',
                stageOn(s.id)
                  ? 'border-primary-ring bg-primary-tint/40'
                  : 'border-line-2 bg-bg-home opacity-60',
              )
            "
          >
            <div class="mb-2 flex items-center gap-2">
              <div
                :class="
                  cn(
                    'grid size-7 place-items-center rounded-[7px]',
                    stageOn(s.id) ? 'bg-primary-tint text-primary' : 'bg-subtle text-faint',
                  )
                "
              >
                <PIcon :name="s.icon" :size="14" />
              </div>
              <PSwitch
                class="ml-auto"
                size="sm"
                :model-value="stageOn(s.id)"
                :label="t(`settings.cicd.stages.${s.id}.label`)"
                @update:model-value="(v) => toggleStage(s.id, v)"
              />
            </div>
            <div class="text-base font-bold">{{ t(`settings.cicd.stages.${s.id}.label`) }}</div>
            <div class="mt-1 text-xs leading-snug text-muted">
              {{ t(`settings.cicd.stages.${s.id}.desc`) }}
            </div>
          </div>
          <ChevronRight
            v-if="i < CI_STAGES.length - 1"
            :size="15"
            class="shrink-0 self-center text-faint-2"
          />
        </template>
      </div>
    </SettingsCard>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
      <SettingsCard :title="t('settings.cicd.recent')">
        <div
          v-for="r in ci.data.value.runs"
          :key="r.n"
          class="flex flex-wrap items-center gap-2.5 border-b border-line-faint px-[18px] py-[11px] last:border-b-0"
        >
          <span class="w-[34px] font-mono text-xs text-faint">#{{ r.n }}</span>
          <div class="min-w-[140px] flex-1">
            <div class="text-base font-semibold">{{ r.title }}</div>
            <div class="text-xs text-faint">{{ relTime(r.at) }} · {{ r.detail }}</div>
          </div>
          <PBadge :tone="STATUS[r.status].tone">
            <component
              :is="STATUS[r.status].icon"
              :size="12"
              :class="r.status === 'running' ? 'animate-spin' : ''"
            />{{ t(`settings.cicd.status.${r.status}`) }}
          </PBadge>
        </div>
        <div v-if="!ci.data.value.runs.length" class="p-6 text-center text-base text-faint">
          {{ t('settings.cicd.noRuns') }}
        </div>
      </SettingsCard>

      <SettingsCard :title="t('settings.cicd.vars')">
        <div
          v-for="v in ci.data.value.variables"
          :key="v.key"
          class="flex items-center gap-2.5 border-b border-line-faint px-[18px] py-2 last:border-b-0"
        >
          <component :is="v.secret ? KeyRound : Variable" :size="14" class="shrink-0 text-faint-2" />
          <span class="w-[38%] min-w-0 truncate font-mono text-sm" :title="v.key">{{ v.key }}</span>
          <div class="min-w-0 flex-1">
            <SecretField
              v-if="v.secret"
              :set="!!v.set"
              :label="v.key"
              @save="(val) => putVar.mutate({ key: v.key, body: { secret: true, value: val } })"
            />
            <PInput
              v-else
              :model-value="plainDrafts[v.key] ?? v.value"
              size="sm"
              mono
              :aria-label="v.key"
              @update:model-value="(x) => (plainDrafts[v.key] = String(x ?? ''))"
              @blur="savePlain(v.key, v.value)"
              @keydown.enter="savePlain(v.key, v.value)"
            />
          </div>
          <PButton
            square
            size="xs"
            variant="ghost"
            :icon="Trash2"
            :aria-label="t('settings.cicd.removeVar', { key: v.key })"
            @click="delVar.mutate(v.key)"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2 border-t border-line-faint bg-bg-home px-[18px] py-2.5">
          <PInput
            :model-value="newKey"
            size="sm"
            mono
            class="w-[38%] min-w-[140px]"
            :invalid="!!keyError"
            :placeholder="t('settings.cicd.newKey')"
            :aria-label="t('settings.cicd.newKey')"
            @update:model-value="
              (x) =>
                (newKey = String(x ?? '')
                  .toUpperCase()
                  .replace(/[^A-Z0-9_]/g, '_'))
            "
          />
          <PInput
            v-model="newValue"
            size="sm"
            mono
            class="min-w-[120px] flex-1"
            :type="newSecret ? 'password' : 'text'"
            autocomplete="new-password"
            :placeholder="t('settings.cicd.value')"
            :aria-label="t('settings.cicd.value')"
            @keydown.enter="addVar"
          />
          <label class="flex items-center gap-1.5 text-xs font-semibold text-fg-2"
            ><PSwitch v-model="newSecret" size="sm" :label="t('settings.cicd.secret')" />{{
              t('settings.cicd.secret')
            }}</label
          >
          <PButton
            size="xs"
            variant="ink"
            :icon="Plus"
            :disabled="!newKey || !!keyError"
            :loading="putVar.isPending.value"
            @click="addVar"
            >{{ t('settings.cicd.add') }}</PButton
          >
        </div>
        <p class="px-[18px] py-2.5 text-xs text-muted">{{ t('settings.cicd.varsNote') }}</p>
      </SettingsCard>
    </div>
  </template>
</template>
