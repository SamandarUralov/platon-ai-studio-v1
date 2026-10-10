<script setup lang="ts">
/**
 * Translations: app languages + key table. Keys are the ones stored in any language plus the labels the
 * app shows by default (pages, tables, roles, workflow states), so new items appear as "missing".
 * Edits are id-addressed: /translations/<lang>/<key>.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@tanstack/vue-query'
import { Plus, Search, Sparkles, Star, X } from 'lucide-vue-next'
import {
  PBadge,
  PButton,
  PInput,
  PSegmented,
  PSelect,
  cn,
  toast,
  type SegmentOption,
  type SelectOption,
} from '@platon/ui'
import { pointer, type AiTranslateResponse, type PatchOp } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { useProjectId } from '@/composables/useProject'
import { errorMessage, http } from '@/services/http'
import SettingsCard from '../components/SettingsCard.vue'
import { LANGUAGE_NAMES, languageLabel } from '../catalog'

const { t } = useI18n()
const def = useDefinitionStore()
const pid = useProjectId()

const d = computed(() => def.definition!)
const languages = computed(() => d.value.settings.languages)
const defaultLang = computed(() => d.value.settings.defaultLanguage)
const others = computed(() => languages.value.filter((l) => l !== defaultLang.value))
const tr = computed(() => d.value.translations)

/** Built-in labels: key → default-language text. */
const builtIn = computed(() => {
  const out: Record<string, string> = {}
  for (const p of d.value.interface.pages) out[`page.${p.id}`] = p.name
  for (const tb of d.value.data.tables) out[`table.${tb.id}`] = tb.name
  for (const r of d.value.roles) out[`role.${r.id}`] = r.name
  for (const w of d.value.workflows) for (const s of w.states) out[`status.${s.id}`] = s.name
  return out
})
const keys = computed(() => {
  const set = new Set(Object.keys(builtIn.value))
  for (const lang of Object.values(tr.value)) for (const k of Object.keys(lang)) set.add(k)
  return [...set].sort()
})
const source = (key: string) => tr.value[defaultLang.value]?.[key] ?? builtIn.value[key] ?? ''
const value = (lang: string, key: string) =>
  lang === defaultLang.value ? source(key) : (tr.value[lang]?.[key] ?? '')
const missingIn = (lang: string) => keys.value.filter((k) => !tr.value[lang]?.[k]?.trim())
const missingCount = computed(() => Object.fromEntries(others.value.map((l) => [l, missingIn(l).length])))
const totalMissing = computed(() => others.value.reduce((n, l) => n + (missingCount.value[l] ?? 0), 0))

// ── Languages ────────────────────────────────────────────────────────────────────────
const addLang = ref<string>('')
const addOptions = computed<SelectOption<string>[]>(() =>
  Object.keys(LANGUAGE_NAMES)
    .filter((c) => !languages.value.includes(c))
    .map((c) => ({ value: c, label: languageLabel(c) })),
)
function addLanguage() {
  const code = addLang.value
  if (!code) return
  const ops: PatchOp[] = [{ op: 'replace', path: '/settings/languages', value: [...languages.value, code] }]
  if (!tr.value[code]) ops.push({ op: 'add', path: pointer('translations', code), value: {} })
  def.apply({
    key: `settings.languages`,
    area: 'Settings',
    text: `Added ${LANGUAGE_NAMES[code] ?? code}`,
    ops,
  })
  addLang.value = ''
}
function removeLanguage(code: string) {
  // Keep stored translations: removing a language from the list is reversible without data loss.
  def.apply({
    key: `settings.languages`,
    area: 'Settings',
    text: `Removed ${LANGUAGE_NAMES[code] ?? code}`,
    ops: [{ op: 'replace', path: '/settings/languages', value: languages.value.filter((l) => l !== code) }],
  })
}
function makeDefault(code: string) {
  def.apply({
    key: 'settings.defaultLanguage',
    area: 'Settings',
    text: `Default language set to ${LANGUAGE_NAMES[code] ?? code}`,
    ops: [{ op: 'replace', path: '/settings/defaultLanguage', value: code }],
  })
}
const pct = (lang: string) =>
  keys.value.length
    ? Math.round(((keys.value.length - (missingCount.value[lang] ?? 0)) / keys.value.length) * 100)
    : 100

// ── Table ────────────────────────────────────────────────────────────────────────────
type Filter = 'all' | 'missing'
const filter = ref<Filter>('all')
const q = ref('')
const filterOptions = computed<SegmentOption<Filter>[]>(() => [
  { value: 'all', label: t('settings.translations.all', { n: keys.value.length }) },
  { value: 'missing', label: t('settings.translations.missing', { n: totalMissing.value }) },
])
const rows = computed(() => {
  const s = q.value.trim().toLowerCase()
  return keys.value.filter((k) => {
    if (filter.value === 'missing' && !others.value.some((l) => !tr.value[l]?.[k]?.trim())) return false
    if (!s) return true
    return [k, ...languages.value.map((l) => value(l, k))].some((x) => x.toLowerCase().includes(s))
  })
})

function opsForSet(lang: string, key: string, text: string): PatchOp[] {
  const v = text.trim()
  const exists = tr.value[lang]?.[key] !== undefined
  if (!tr.value[lang])
    return v ? [{ op: 'add', path: pointer('translations', lang), value: { [key]: v } }] : []
  if (!v) return exists ? [{ op: 'remove', path: pointer('translations', lang, key) }] : []
  return [{ op: exists ? 'replace' : 'add', path: pointer('translations', lang, key), value: v }]
}
function commit(lang: string, key: string, e: Event) {
  const text = (e.target as HTMLInputElement).value
  if (text.trim() === value(lang, key)) return
  const ops = opsForSet(lang, key, text)
  if (ops.length)
    def.apply({
      key: `translations.${lang}.${key}`,
      area: 'Settings',
      text: `Translated “${key}” (${lang})`,
      ops,
    })
}

const translate = useMutation({
  mutationFn: async () => {
    const results: AiTranslateResponse[] = []
    for (const lang of others.value) {
      const items = Object.fromEntries(
        missingIn(lang)
          .map((k) => [k, source(k)])
          .filter(([, s]) => s),
      )
      if (!Object.keys(items).length) continue
      results.push(
        (
          await http.post<AiTranslateResponse>(`/projects/${pid.value}/translations/ai-translate`, {
            language: lang,
            items,
          })
        ).data,
      )
    }
    return results
  },
  onSuccess: (results) => {
    const ops: PatchOp[] = []
    let n = 0
    for (const r of results) {
      const entries = Object.entries(r.translations)
      n += entries.length
      if (!tr.value[r.language])
        ops.push({ op: 'add', path: pointer('translations', r.language), value: Object.fromEntries(entries) })
      else
        for (const [k, v] of entries)
          ops.push({ op: 'add', path: pointer('translations', r.language, k), value: v })
    }
    if (!ops.length) return toast(t('settings.translations.nothingMissing'))
    def.apply({
      key: `translations.ai.${Date.now()}`,
      area: 'Settings',
      text: `Studio AI translated ${n} missing labels`,
      ops,
    })
    toast(t('settings.translations.translated', { n }), {
      tone: 'ok',
      action: { label: t('settings.undo'), run: () => def.undo() },
    })
  },
  onError: (e) => toast(errorMessage(e), { tone: 'danger' }),
})
</script>

<template>
  <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
    <div v-for="l in languages" :key="l" class="rounded-xl border border-line-2 bg-surface px-4 py-3.5">
      <div class="flex items-center gap-2">
        <span class="text-lg font-bold">{{ LANGUAGE_NAMES[l] ?? l }}</span>
        <span class="font-mono text-xs text-faint">{{ l }}</span>
        <PBadge v-if="l === defaultLang" size="xs" tone="primary">{{
          t('settings.translations.default')
        }}</PBadge>
        <span class="ml-auto text-base font-bold">{{ l === defaultLang ? '100%' : `${pct(l)}%` }}</span>
      </div>
      <div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line-soft">
        <div
          :class="cn('h-full rounded-full', l === defaultLang || pct(l) === 100 ? 'bg-ok-dot' : 'bg-primary')"
          :style="{ width: `${l === defaultLang ? 100 : pct(l)}%` }"
        />
      </div>
      <div class="mt-2 flex items-center gap-1 text-xs text-muted">
        <span class="flex-1">{{
          l === defaultLang
            ? t('settings.translations.source')
            : t('settings.translations.missingN', { n: missingCount[l] })
        }}</span>
        <template v-if="l !== defaultLang">
          <PButton
            size="xs"
            variant="ghost"
            :icon="Star"
            :title="t('settings.translations.makeDefault')"
            :aria-label="t('settings.translations.makeDefault')"
            square
            @click="makeDefault(l)"
          />
          <PButton
            size="xs"
            variant="ghost"
            :icon="X"
            :title="t('settings.translations.remove')"
            :aria-label="t('settings.translations.removeLang', { name: LANGUAGE_NAMES[l] ?? l })"
            square
            @click="removeLanguage(l)"
          />
        </template>
      </div>
    </div>
    <div class="flex flex-col justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line p-3.5">
      <PSelect
        v-model="addLang"
        :options="addOptions"
        size="sm"
        :placeholder="t('settings.translations.pickLanguage')"
        :aria-label="t('settings.translations.pickLanguage')"
      />
      <PButton size="sm" :icon="Plus" :disabled="!addLang" @click="addLanguage">{{
        t('settings.translations.addLanguage')
      }}</PButton>
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2.5">
    <PSegmented v-model="filter" :options="filterOptions" :aria-label="t('settings.translations.filter')" />
    <PInput
      v-model="q"
      :icon="Search"
      size="sm"
      class="w-[240px]"
      :placeholder="t('settings.translations.search')"
      :aria-label="t('settings.translations.search')"
    />
    <PButton
      v-if="others.length"
      variant="ai"
      :icon="Sparkles"
      class="ml-auto"
      :loading="translate.isPending.value"
      :disabled="!totalMissing"
      @click="translate.mutate()"
    >
      {{
        totalMissing
          ? t('settings.translations.aiTranslate', { n: totalMissing })
          : t('settings.translations.allTranslated')
      }}
    </PButton>
  </div>

  <SettingsCard>
    <div class="overflow-x-auto scroll-thin">
      <table class="w-full min-w-[640px] border-collapse text-base">
        <thead>
          <tr class="border-b border-line-soft bg-bg-home text-left text-xs font-semibold text-muted">
            <th class="w-[220px] px-[18px] py-2.5 font-semibold">{{ t('settings.translations.key') }}</th>
            <th v-for="l in [defaultLang, ...others]" :key="l" class="px-3 py-2.5 font-semibold">
              {{ LANGUAGE_NAMES[l] ?? l
              }}<span v-if="l === defaultLang" class="text-faint">
                · {{ t('settings.translations.default').toLowerCase() }}</span
              >
              <span v-else-if="missingCount[l]" class="text-warn">
                · {{ t('settings.translations.missingN', { n: missingCount[l] }) }}</span
              >
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="k in rows" :key="k" class="border-b border-line-faint last:border-b-0">
            <td class="max-w-[220px] truncate px-[18px] py-1.5 font-mono text-xs text-muted" :title="k">
              {{ k }}
            </td>
            <td v-for="l in [defaultLang, ...others]" :key="l" class="px-2 py-1.5">
              <input
                :value="value(l, k)"
                :placeholder="l === defaultLang ? '' : source(k)"
                :aria-label="`${k} · ${LANGUAGE_NAMES[l] ?? l}`"
                :class="
                  cn(
                    'h-8 w-full rounded-[7px] border bg-surface px-2 text-base text-fg outline-none placeholder:text-faint-2 focus:border-primary focus:shadow-focus',
                    l !== defaultLang && !value(l, k)
                      ? 'border-warn/40 bg-warn-bg/40'
                      : 'border-transparent hover:border-line',
                  )
                "
                @change="commit(l, k, $event)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="p-6 text-center text-base text-faint">
        {{
          filter === 'missing'
            ? t('settings.translations.nothingMissing')
            : t('settings.translations.noMatch')
        }}
      </div>
    </div>
  </SettingsCard>
</template>
