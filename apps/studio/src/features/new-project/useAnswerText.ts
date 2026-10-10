/** Turns flow ids (options, answers, acks, build tasks) into localized text. */
import { useI18n } from 'vue-i18n'
import { BLUEPRINT, DEFAULT_ROLE, questionById, type QuestionId } from './catalog'
import { ENGINES, type DbEngine } from '@platon/definition'
import type { Ack, Answer, BuildTask, NewProjectFlow } from './flow'

export function useAnswerText(flow: NewProjectFlow) {
  const { t } = useI18n()

  function optionLabel(ns: string, id: string): string {
    if (ns === 'engine') return ENGINES[id as DbEngine]?.label ?? id
    return t(`newProject.opt.${ns}.${id}`)
  }

  const list = (ns: string, v: unknown) =>
    Array.isArray(v) ? v.map((id: string) => optionLabel(ns, id)).join(', ') : ''

  function summarize(id: QuestionId, a: Answer | undefined): string {
    if (!a) return ''
    if (a.text) return a.text
    const s = a.sel
    let r = ''
    switch (id) {
      case 'signin':
      case 'modules':
      case 'langs':
        r = list(id, s.v)
        break
      case 'theme':
        r = t('newProject.fmt.theme', {
          color: optionLabel('color', String(s.color)),
          mode: optionLabel('mode', String(s.mode)),
          radius: optionLabel('radius', String(s.radius)),
        })
        break
      case 'team':
        r = (Array.isArray(s.v) ? s.v : [])
          .map((uid) => {
            const p = flow.person(uid)
            const role = a.roles[uid] ?? DEFAULT_ROLE
            return t('newProject.fmt.member', { name: p?.name ?? uid, role: t(`newProject.roles.${role}`) })
          })
          .join(', ')
        break
      case 'data':
        r = [
          optionLabel('engine', String(s.engine)),
          optionLabel('storage', String(s.storage)),
          optionLabel('sample', String(s.sample)),
        ].join(' · ')
        break
    }
    return a.skipped ? t('newProject.fmt.default', { value: r }) : r
  }

  function ackText(ack: Ack): string {
    if (ack.kind === 'text') return t('newProject.ack.text')
    if (ack.kind === 'skipped') return t('newProject.ack.skipped')
    const s = ack.answer.sel
    const n = Array.isArray(s.v) ? s.v.length : 0
    switch (ack.q) {
      case 'signin':
      case 'modules':
        return t(`newProject.ack.${ack.q}`, { n }, n)
      case 'theme':
        return t('newProject.ack.theme', {
          color: optionLabel('color', String(s.color)),
          mode: optionLabel('mode', String(s.mode)).toLowerCase(),
        })
      case 'langs':
        return t('newProject.ack.langs', {
          lang: optionLabel('langs', Array.isArray(s.v) && s.v[0] ? s.v[0] : 'en'),
        })
      default:
        return t(`newProject.ack.${ack.q}`)
    }
  }

  const questionText = (
    id: QuestionId,
    field: 'label' | 'text' | 'hint',
    params: Record<string, string> = {},
  ) => t(`newProject.q.${id}.${field}`, params)

  function taskDetail(task: BuildTask): string {
    const val = (id: QuestionId) => summarize(id, flow.value(id))
    switch (task) {
      case 'requirements':
        return t('newProject.taskDetail.inScope', { n: flow.inScope.value })
      case 'model':
        return t('newProject.taskDetail.tables', { n: BLUEPRINT.tables.length })
      case 'pages':
        return t('newProject.taskDetail.pages', { n: BLUEPRINT.pages.length })
      case 'roles':
        return BLUEPRINT.roles.join(', ')
      case 'invite': {
        const v = flow.value('team').sel.v
        const n = Math.max(0, (Array.isArray(v) ? v.length : 0) - 1)
        return t('newProject.taskDetail.invites', { n }, n)
      }
      default:
        return val(task)
    }
  }

  return { t, optionLabel, summarize, ackText, questionText, taskDetail, question: questionById }
}
