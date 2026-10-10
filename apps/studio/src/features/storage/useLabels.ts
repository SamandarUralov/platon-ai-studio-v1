/** i18n label helpers shared by Storage components. */
import { useI18n } from 'vue-i18n'
import { cleanupDays } from './utils'

export function useLabels() {
  const { t } = useI18n()
  /** '7d' → "After 7 days", '' → "Never". */
  const cleanup = (rule: string | undefined) => {
    const n = cleanupDays(rule)
    return n === null ? t('storage.cleanup.never') : t('storage.cleanup.after', { n }, n)
  }
  return { cleanup }
}
