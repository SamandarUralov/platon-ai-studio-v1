import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import uz from '@/locales/uz.json'
import ru from '@/locales/ru.json'

export const STUDIO_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'uz', label: 'Oʻzbekcha' },
  { id: 'ru', label: 'Русский' },
] as const

type Messages = Record<string, unknown>

/**
 * Each feature keeps its strings in `features/<name>/locales/<lang>.json`; they are mounted under
 * the feature name, e.g. features/logic/locales/en.json → t('logic.someKey').
 */
const featureFiles = import.meta.glob<Messages>('../features/*/locales/*.json', {
  eager: true,
  import: 'default',
})

function build(lang: string, base: Messages): Messages {
  const out: Messages = { ...base }
  for (const [path, msgs] of Object.entries(featureFiles)) {
    const m = /features\/([^/]+)\/locales\/([^/]+)\.json$/.exec(path)
    if (m && m[2] === lang) out[m[1]!.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = msgs
  }
  return out
}

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  // Feature files are merged at runtime, so the message schema can't be inferred statically.
  messages: { en: build('en', en), uz: build('uz', uz), ru: build('ru', ru) } as never,
  missingWarn: false,
  fallbackWarn: false,
})
