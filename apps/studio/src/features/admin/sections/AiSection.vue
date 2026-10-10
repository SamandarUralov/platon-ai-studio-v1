<script setup lang="ts">
/**
 * AI agents: providers (write-only API keys, enabled models, default model), per-feature models, monthly
 * budget with usage, token chart, data rules and MCP tool servers.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Plus, Server, Sparkles, Trash2 } from 'lucide-vue-next'
import {
  PBadge,
  PButton,
  PField,
  PInput,
  PSelect,
  PSpinner,
  PSwitch,
  cn,
  type SelectOption,
} from '@platon/ui'
import {
  AI_FEATURES,
  type AiFeature,
  type AiProvider,
  type AiSettings,
  type UpdateAiProviderRequest,
  type UpdateAiSettingsRequest,
} from '@platon/definition'
import { http } from '@/services/http'
import AdminCard from '../components/AdminCard.vue'
import SecretField from '../components/SecretField.vue'
import TokenChart from '../components/TokenChart.vue'
import { adminKeys, useAdminMutation, useAi } from '../api'

const { t } = useI18n()
const ai = useAi()

const patch = useAdminMutation(
  async (b: UpdateAiSettingsRequest) => (await http.patch<AiSettings>('/admin/ai', b)).data,
  { key: adminKeys.ai },
)
const patchProvider = useAdminMutation(
  async (v: { id: string; body: UpdateAiProviderRequest }) =>
    (await http.patch<AiSettings>(`/admin/ai/providers/${v.id}`, v.body)).data,
  {
    key: adminKeys.ai,
    success: (_r, v) => (v.body.key !== undefined ? t('admin.ai.keySaved') : undefined),
  },
)
const addMcp = useAdminMutation(
  async (b: { name: string; url: string }) => (await http.post<AiSettings>('/admin/ai/mcp', b)).data,
  { key: adminKeys.ai, success: (_r, b) => t('admin.ai.mcpAdded', { name: b.name }) },
)
const toggleMcp = useAdminMutation(
  async (v: { id: string; enabled: boolean }) =>
    (await http.patch<AiSettings>(`/admin/ai/mcp/${v.id}`, { enabled: v.enabled })).data,
  { key: adminKeys.ai },
)
const removeMcp = useAdminMutation(
  async (id: string) => (await http.delete<AiSettings>(`/admin/ai/mcp/${id}`)).data,
  { key: adminKeys.ai, success: () => t('admin.ai.mcpRemoved') },
)

const providers = computed(() => {
  const d = ai.data.value
  return d
    ? [...d.providers].sort((a, b) => Number(b.id === d.defaultProvider) - Number(a.id === d.defaultProvider))
    : []
})
function toggleModel(p: AiProvider, m: string) {
  const on = p.enabledModels.includes(m)
  patchProvider.mutate({
    id: p.id,
    body: { enabledModels: on ? p.enabledModels.filter((x) => x !== m) : [...p.enabledModels, m] },
  })
}
const modelOptions = (p: AiProvider): SelectOption<string>[] =>
  p.enabledModels.map((m) => ({ value: m, label: m }))

const allModels = computed<SelectOption<string>[]>(() =>
  (ai.data.value?.providers ?? [])
    .filter((p) => p.enabled)
    .flatMap((p) => p.enabledModels.map((m) => ({ value: m, label: m, description: p.name }))),
)
function setFeature(f: AiFeature, m: string | undefined) {
  if (m) patch.mutate({ featureModels: { ...ai.data.value!.featureModels, [f]: m } })
}

// ── Budget ───────────────────────────────────────────────────────────────────────────
const pct = computed(() =>
  ai.data.value ? Math.round((ai.data.value.spent / Math.max(1, ai.data.value.budget)) * 100) : 0,
)
const budgetState = computed(() => {
  const d = ai.data.value
  if (!d) return { tone: 'ok' as const, text: '' }
  if (pct.value >= 100) return { tone: 'danger' as const, text: t('admin.ai.stopped') }
  if (pct.value >= d.warnAt) return { tone: 'warn' as const, text: t('admin.ai.warned') }
  return { tone: 'ok' as const, text: t('admin.ai.within') }
})
const BUDGETS = ['500', '1000', '2000', '3000', '5000']
const budgetOptions = computed<SelectOption<string>[]>(() => {
  const cur = String(ai.data.value?.budget ?? '')
  return [...new Set([...BUDGETS, cur])]
    .filter(Boolean)
    .map((b) => ({ value: b, label: `$${Number(b).toLocaleString()}` }))
})
const warnOptions: SelectOption<string>[] = ['50', '70', '80', '90'].map((w) => ({
  value: w,
  label: `${w}%`,
}))
const tokens = computed(() => {
  const m = ai.data.value?.byModel ?? []
  return { input: m.reduce((n, x) => n + x.input, 0), output: m.reduce((n, x) => n + x.output, 0) }
})
const byModel = computed(() => {
  const list = ai.data.value?.byModel ?? []
  const top = Math.max(1, ...list.map((x) => x.cost))
  return [...list]
    .sort((a, b) => b.cost - a.cost)
    .map((x) => ({ ...x, w: `${Math.round((x.cost / top) * 100)}%` }))
})

// ── Policy + MCP ─────────────────────────────────────────────────────────────────────
const POLICY = ['noProduction', 'noSecrets', 'localOnly'] as const
function setPolicy(k: (typeof POLICY)[number], v: boolean) {
  patch.mutate({ policy: { ...ai.data.value!.policy, [k]: v } })
}
const mcpName = ref('')
const mcpUrl = ref('')
function submitMcp() {
  if (!mcpName.value.trim() || !mcpUrl.value.trim()) return
  addMcp.mutate(
    { name: mcpName.value.trim(), url: mcpUrl.value.trim() },
    { onSuccess: () => ((mcpName.value = ''), (mcpUrl.value = '')) },
  )
}
</script>

<template>
  <div v-if="ai.isLoading.value" class="grid place-items-center py-16 text-muted">
    <PSpinner :size="20" />
  </div>
  <template v-else-if="ai.data.value">
    <AdminCard :title="t('admin.ai.providers')" :description="t('admin.ai.providersDesc')">
      <div v-for="p in providers" :key="p.id" class="border-b border-line-faint px-4 py-3.5 last:border-b-0">
        <div class="flex flex-wrap items-center gap-3">
          <div
            class="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-primary-tint text-primary-strong"
          >
            <component :is="p.needsKey ? Sparkles : Server" :size="16" />
          </div>
          <div class="min-w-[180px] flex-1">
            <div class="flex items-center gap-2 text-md font-semibold">
              {{ p.name
              }}<PBadge v-if="ai.data.value.defaultProvider === p.id" size="xs" tone="primary">{{
                t('admin.ai.default')
              }}</PBadge>
            </div>
            <div class="text-xs text-faint">
              {{ t('admin.ai.kind', { kind: p.kind, n: p.enabledModels.length, total: p.models.length }) }}
            </div>
          </div>
          <label class="flex items-center gap-1.5 text-xs text-muted">
            {{ t('admin.ai.defaultModel') }}
            <PSelect
              :model-value="p.defaultModel"
              :options="modelOptions(p)"
              size="sm"
              class="w-[150px]"
              :aria-label="t('admin.ai.defaultModelFor', { name: p.name })"
              @update:model-value="(m) => m && patchProvider.mutate({ id: p.id, body: { defaultModel: m } })"
            />
          </label>
          <PButton
            size="xs"
            :variant="ai.data.value.defaultProvider === p.id ? 'tint' : 'outline'"
            :disabled="!p.enabled || ai.data.value.defaultProvider === p.id"
            @click="patch.mutate({ defaultProvider: p.id })"
          >
            {{ ai.data.value.defaultProvider === p.id ? t('admin.ai.default') : t('admin.ai.makeDefault') }}
          </PButton>
          <PSwitch
            :model-value="p.enabled"
            :label="p.name"
            @update:model-value="(v) => patchProvider.mutate({ id: p.id, body: { enabled: v } })"
          />
        </div>
        <div
          class="ml-[46px] mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,300px)] items-start gap-3 max-[900px]:grid-cols-1"
          :class="p.enabled ? '' : 'opacity-60'"
        >
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="m in p.models"
              :key="m"
              type="button"
              :aria-pressed="p.enabledModels.includes(m)"
              :class="
                cn(
                  'flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold',
                  p.enabledModels.includes(m)
                    ? 'border-primary bg-primary-tint text-primary-strong'
                    : 'border-line bg-surface text-muted hover:text-fg',
                )
              "
              @click="toggleModel(p, m)"
            >
              <component :is="p.enabledModels.includes(m) ? Check : Plus" :size="12" />{{ m }}
            </button>
          </div>
          <SecretField
            v-if="p.needsKey"
            :set="p.keySet"
            :label="t('admin.ai.apiKey', { name: p.name })"
            :saving="patchProvider.isPending.value"
            @save="(k) => patchProvider.mutate({ id: p.id, body: { key: k } })"
          />
          <span v-else class="text-xs text-muted">{{ t('admin.ai.noKey') }}</span>
        </div>
      </div>
    </AdminCard>

    <AdminCard
      :title="t('admin.ai.features')"
      :description="t('admin.ai.featuresDesc')"
      body-class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 p-[18px]"
    >
      <PField v-for="f in AI_FEATURES" :key="f" :label="t(`admin.ai.feature.${f}`)">
        <PSelect
          :model-value="ai.data.value.featureModels[f]"
          :options="allModels"
          :aria-label="t(`admin.ai.feature.${f}`)"
          @update:model-value="(m) => setFeature(f, m)"
        />
      </PField>
    </AdminCard>

    <AdminCard :title="t('admin.ai.budget')" body-class="p-[18px]">
      <div class="flex flex-wrap items-baseline gap-2.5">
        <span class="text-[22px] font-extrabold">${{ ai.data.value.spent.toLocaleString() }}</span>
        <span class="text-base text-muted">{{
          t('admin.ai.ofMonth', { budget: ai.data.value.budget.toLocaleString(), pct })
        }}</span>
        <div class="ml-auto flex flex-wrap items-center gap-2.5">
          <label class="flex items-center gap-1.5 text-sm text-fg-2"
            >{{ t('admin.ai.monthly')
            }}<PSelect
              :model-value="String(ai.data.value.budget)"
              :options="budgetOptions"
              size="sm"
              class="w-[100px]"
              :aria-label="t('admin.ai.monthly')"
              @update:model-value="(v) => v && patch.mutate({ budget: Number(v) })"
          /></label>
          <label class="flex items-center gap-1.5 text-sm text-fg-2"
            >{{ t('admin.ai.warnAt')
            }}<PSelect
              :model-value="String(ai.data.value.warnAt)"
              :options="warnOptions"
              size="sm"
              class="w-[80px]"
              :aria-label="t('admin.ai.warnAt')"
              @update:model-value="(v) => v && patch.mutate({ warnAt: Number(v) })"
          /></label>
        </div>
      </div>
      <div
        class="relative mb-1.5 mt-3.5 h-2.5 rounded-full bg-line-soft"
        role="progressbar"
        :aria-valuenow="pct"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="t('admin.ai.budget')"
      >
        <div
          :class="
            cn(
              'h-full rounded-full',
              budgetState.tone === 'danger'
                ? 'bg-danger-dot'
                : budgetState.tone === 'warn'
                  ? 'bg-warn-dot'
                  : 'bg-primary',
            )
          "
          :style="{ width: `${Math.min(100, pct)}%` }"
        />
        <div
          class="absolute -bottom-1 -top-1 w-0.5 rounded bg-fg-2"
          :style="{ left: `${ai.data.value.warnAt}%` }"
          :title="t('admin.ai.warnLine', { n: ai.data.value.warnAt })"
        />
      </div>
      <div class="flex justify-between text-xs text-faint">
        <span>$0</span><span>{{ t('admin.ai.warnLine', { n: ai.data.value.warnAt }) }}</span>
      </div>
      <div
        :class="
          cn(
            'mt-3 rounded-[9px] px-3 py-2.5 text-sm',
            budgetState.tone === 'danger'
              ? 'bg-danger-bg text-danger'
              : budgetState.tone === 'warn'
                ? 'bg-warn-bg text-warn'
                : 'bg-ok-bg text-ok',
          )
        "
      >
        {{ budgetState.text }}
      </div>
      <div class="mt-3.5 grid grid-cols-3 gap-2">
        <div class="rounded-[10px] border border-line-soft bg-bg-home px-3 py-2.5">
          <div class="text-xs font-semibold text-muted">{{ t('admin.ai.tokens') }}</div>
          <div class="mt-0.5 text-[16px] font-extrabold">
            {{ (tokens.input + tokens.output).toFixed(1) }}M
          </div>
        </div>
        <div class="rounded-[10px] border border-line-soft bg-bg-home px-3 py-2.5">
          <div class="text-xs font-semibold text-muted">{{ t('admin.ai.split') }}</div>
          <div class="mt-1 text-base font-bold">
            {{ tokens.input.toFixed(1) }}M · {{ tokens.output.toFixed(1) }}M
          </div>
        </div>
        <div class="rounded-[10px] border border-line-soft bg-bg-home px-3 py-2.5">
          <div class="text-xs font-semibold text-muted">{{ t('admin.ai.requests') }}</div>
          <div class="mt-0.5 text-[16px] font-extrabold">
            {{ Math.round((tokens.input * 1000) / 7.4).toLocaleString() }}
          </div>
        </div>
      </div>
      <div class="eyebrow mb-2.5 mt-5">{{ t('admin.ai.daily') }}</div>
      <TokenChart :days="ai.data.value.usage" />
      <div class="eyebrow mb-2 mt-5">{{ t('admin.ai.byModel') }}</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[480px] text-sm">
          <thead>
            <tr class="text-xs text-faint">
              <th class="py-1.5 text-left font-semibold">{{ t('admin.ai.model') }}</th>
              <th class="py-1.5 text-right font-semibold">{{ t('admin.ai.input') }}</th>
              <th class="py-1.5 text-right font-semibold">{{ t('admin.ai.output') }}</th>
              <th class="py-1.5 text-right font-semibold">{{ t('admin.ai.cost') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in byModel" :key="m.model" class="border-t border-line-faint">
              <td class="py-1.5 pr-3">
                <div class="font-semibold">{{ m.model }}</div>
                <div class="mt-1 h-1 rounded-full bg-line-soft">
                  <div class="h-full rounded-full bg-primary" :style="{ width: m.w }" />
                </div>
              </td>
              <td class="py-1.5 text-right font-mono text-xs text-fg-2">{{ m.input.toFixed(1) }}M</td>
              <td class="py-1.5 text-right font-mono text-xs text-fg-2">{{ m.output.toFixed(1) }}M</td>
              <td class="py-1.5 text-right font-bold">${{ m.cost.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminCard>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
      <AdminCard :title="t('admin.ai.rules')">
        <div
          v-for="k in POLICY"
          :key="k"
          class="flex items-center gap-3 border-b border-line-faint px-[18px] py-3 last:border-b-0"
        >
          <span class="flex-1 text-base">{{ t(`admin.ai.policy.${k}`) }}</span>
          <PSwitch
            :model-value="ai.data.value.policy[k]"
            :label="t(`admin.ai.policy.${k}`)"
            @update:model-value="(v) => setPolicy(k, v)"
          />
        </div>
      </AdminCard>
      <AdminCard :title="t('admin.ai.mcp')" :description="t('admin.ai.mcpDesc')">
        <div
          v-for="m in ai.data.value.mcp"
          :key="m.id"
          class="flex items-center gap-3 border-b border-line-faint px-[18px] py-2.5"
        >
          <div class="min-w-0 flex-1">
            <div class="text-base font-semibold">{{ m.name }}</div>
            <div class="truncate font-mono text-xs text-faint">{{ m.url }}</div>
          </div>
          <PSwitch
            :model-value="m.enabled"
            :label="m.name"
            @update:model-value="(v) => toggleMcp.mutate({ id: m.id, enabled: v })"
          />
          <PButton
            square
            size="xs"
            variant="ghost"
            :icon="Trash2"
            :aria-label="t('admin.ai.removeMcp', { name: m.name })"
            @click="removeMcp.mutate(m.id)"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2 bg-bg-home px-[18px] py-2.5">
          <PInput
            v-model="mcpName"
            size="sm"
            class="w-[130px]"
            :placeholder="t('admin.ai.mcpName')"
            :aria-label="t('admin.ai.mcpName')"
          />
          <PInput
            v-model="mcpUrl"
            size="sm"
            mono
            class="min-w-[140px] flex-1"
            placeholder="https://"
            :aria-label="t('admin.ai.mcpUrl')"
            @keydown.enter="submitMcp"
          />
          <PButton
            size="xs"
            variant="ink"
            :icon="Plus"
            :disabled="!mcpName.trim() || !mcpUrl.trim()"
            :loading="addMcp.isPending.value"
            @click="submitMcp"
            >{{ t('admin.ai.add') }}</PButton
          >
        </div>
      </AdminCard>
    </div>
  </template>
</template>
