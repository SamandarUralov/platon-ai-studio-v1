/**
 * The page script as a draft (requirements §3.3 "Saving"): edits stay local until ⌘S, which writes
 * one `~ interface.pages.<id>.script` change. Pages without a script show the generated default; the
 * first edit creates the script so the draft has something to snapshot.
 */
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Page, PageScript } from '@platon/definition'
import { useDraftsStore } from '@/stores/drafts'
import { useInterfaceEdits } from '../composables/useInterfaceEdits'
import { scriptPath } from '../lib/patch'
import { defaultScript, ensureHandler, scriptFile } from '../lib/script'

export function usePageScript(page: MaybeRefOrGetter<Page>) {
  const drafts = useDraftsStore()
  const edits = useInterfaceEdits()
  const { t } = useI18n()
  const p = () => toValue(page)
  const path = computed(() => scriptPath(p().id))

  const source = computed(() => drafts.value<PageScript>(path.value)?.source ?? defaultScript(p()))
  const dirty = computed(() => drafts.isDirty(path.value))
  const exists = computed(() => !!p().script)
  const file = computed(() => scriptFile(p()))

  function edit(next: string) {
    if (next === source.value) return
    if (!p().script && !edits.ensureScript(p(), defaultScript(p()))) return
    drafts.edit<PageScript>(path.value, (s) => ({ ...s, source: next }))
  }

  function save() {
    return drafts.save(path.value, {
      key: `interface.pages.${p().id}.script`,
      area: 'Pages',
      text: t('interface.change.script', { page: p().name }),
    })
  }

  function discard() {
    drafts.discard(path.value)
  }

  /** Make sure `ref.event` has a handler; returns the line to jump to. */
  function handler(ref: string, event: string): number {
    const r = ensureHandler(source.value, ref, event)
    if (r.added) edit(r.source)
    return r.line
  }

  return { source, dirty, exists, file, path, edit, save, discard, handler }
}
