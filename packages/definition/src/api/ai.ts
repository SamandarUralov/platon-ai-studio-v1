/**
 * Studio API contract — ai (requirements §3.9, §4.4, §6.1).
 *
 * The assistant only *proposes*: plans and diffs carry ready-to-apply `ChangeInput`s, but nothing
 * touches the definition until the user applies them through the definition store.
 */
import type { ChangeArea } from '../generated/change'
import type { ChangeInput } from '../changes'

export type AiModel = 'claude' | 'gpt'

export type AiContextKind =
  | 'project'
  | 'page'
  | 'block'
  | 'function'
  | 'api'
  | 'cron'
  | 'queue'
  | 'table'
  | 'connection'
  | 'storage'
  | 'component'
  | 'code'

/** What the user is looking at / attached. `path` is a definition pointer. */
export interface AiContextRef {
  kind: AiContextKind
  path?: string
  label: string
}

/** A chip on a user message: a skill (`/table`) or attached context (`@Page: Work orders`). */
export interface AiChip {
  kind: 'skill' | 'ctx'
  key: string
  label: string
  /** lucide kebab-case icon name */
  icon: string
  /** skill id for skill chips */
  skill?: string
  /** context for ctx chips */
  context?: AiContextRef
}

export type AiPlanStatus = 'pending' | 'applied' | 'discarded'
export type AiItemStatus = 'pending' | 'applied' | 'skipped'

export interface AiPlanItem {
  id: string
  area: ChangeArea
  title: string
  detail: string
  /** Readable summary of the definition edit, shown under "Show definition change". */
  meta: string
  change: ChangeInput
  status: AiItemStatus
}

export interface AiPlan {
  id: string
  title: string
  status: AiPlanStatus
  items: AiPlanItem[]
  /** Hint shown after applying (e.g. where to look). */
  after?: string
}

export interface AiDiffLine {
  /** '+' added, '-' removed, ' ' context */
  k: '+' | '-' | ' '
  s: string
}

/** A code edit to one file (page script). Applying it applies `change`. */
export interface AiDiff {
  id: string
  file: string
  lines: AiDiffLine[]
  change: ChangeInput
  status: AiPlanStatus
}

export interface AiNaming {
  kind: 'component' | 'page'
  folder: 'components' | 'pages'
  options: string[]
  picked?: string
  status: 'pending' | 'done'
}

export type AiGenStepState = 'done' | 'on' | 'todo'

export interface AiComponentGen {
  name: string
  file: string
  /** id the component gets in the definition once its plan is applied */
  componentId: string
  steps: { label: string; state: AiGenStepState }[]
  props: { name: string; type: string }[]
  status: 'generating' | 'ready'
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  /** Markdown for assistant messages, plain text for user messages. */
  text: string
  createdAt: string
  /** Author display name (user messages). */
  author?: string
  chips?: AiChip[]
  /** "Using X as context. Following Agent.md." */
  note?: string
  plan?: AiPlan
  diff?: AiDiff
  naming?: AiNaming
  component?: AiComponentGen
  /** Show "Open preview" / "See all changes" links. */
  links?: boolean
  /** Assistant message was stopped by the user. */
  stopped?: boolean
}

export interface AiConversationSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  /** Who started it */
  by: string
  messageCount: number
  appliedCount: number
  hasPendingPlan: boolean
  snippet: string
}

export interface AiConversation extends AiConversationSummary {
  messages: AiMessage[]
}

export interface AiConversationsResponse {
  items: AiConversationSummary[]
}

export interface CreateAiConversationRequest {
  title?: string
}

export interface SendAiMessageRequest {
  text: string
  chips: AiChip[]
  /** The selection in the layer the panel sits in. */
  context?: AiContextRef | null
  model: AiModel
  /** Plain-language summaries of human edits since the assistant last answered. */
  recentEdits?: string[]
  /** Answering a naming picker: id of the assistant message that asked. */
  namingFor?: string
}

/** Context budget info that only the server knows. */
export interface AiContextInfo {
  maxTokens: number
  systemTokens: number
  agentMdTokens: number
  models: { id: AiModel; label: string }[]
}

export interface ApplyAiPlanRequest {
  /** Items the user kept checked; the rest are recorded as skipped. */
  itemIds: string[]
}

export interface AiPlanActionResponse {
  plan?: AiPlan
  diff?: AiDiff
  /** Follow-up assistant message ("Applied 3 of 4 changes…"). */
  message?: AiMessage
}

/**
 * Server-sent events of `POST …/ai/conversations/{cid}/messages`.
 * Each SSE frame has `event: <type>` and `data: <JSON payload>`.
 */
export type AiStreamEvent =
  | { type: 'start'; userMessage: AiMessage; messageId: string; title: string }
  | { type: 'token'; text: string }
  | { type: 'note'; text: string }
  | { type: 'plan'; plan: AiPlan }
  | { type: 'diff'; diff: AiDiff }
  | { type: 'naming'; naming: AiNaming }
  | { type: 'component'; component: AiComponentGen }
  | { type: 'links' }
  | { type: 'done'; message: AiMessage }
  | { type: 'error'; message: string }

export type AiStreamEventType = AiStreamEvent['type']
