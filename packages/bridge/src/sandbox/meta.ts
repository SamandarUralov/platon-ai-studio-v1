/**
 * Sandbox meta contract — mirror of platon-sandbox `src/contracts/types.ts` (SPEC §2).
 * The Sandbox owns this shape; keep it in sync there first. Studio builds it from the app
 * definition (apps/studio/src/services/sandbox/meta.ts).
 */
export type SandboxMode = 'interface' | 'preview'
export type SandboxDataMode = 'mock' | 'live'

export interface SandboxDataModel {
  table: string
  columns: { name: string; type: string }[]
  seed?: Record<string, unknown>[]
}

export interface SandboxCustomComponent {
  id: string
  name: string
  kind: 'vue' | 'js'
  code: string
}

export interface SandboxMenuNode {
  id: string
  label: string
  page?: string
  icon?: string
  visible_to?: string[]
  children?: SandboxMenuNode[]
}

export interface SandboxStructuredQuery {
  table: string
  columns?: string[]
  filter?: Record<string, unknown>
}

export interface SandboxBlock {
  id: string
  component: string
  props?: Record<string, unknown>
  items?: unknown[]
  query?: string | SandboxStructuredQuery
  visible_to?: string[]
  layout?: Record<string, unknown>
  children?: SandboxBlock[]
}

export type SandboxLifecycle = Partial<
  Record<
    | 'onPageInit'
    | 'onBeforeRender'
    | 'onPageReady'
    | 'onBeforeRefresh'
    | 'onAfterRefresh'
    | 'onPageResume'
    | 'onPagePause'
    | 'onBeforeLeave'
    | 'onPageLeave'
    | 'onPageError',
    string
  >
>

export interface SandboxPage {
  id: string
  label: string
  path: string
  parent?: string | null
  in_menu?: boolean
  visible_to?: string[]
  lifecycle?: SandboxLifecycle
  blocks: SandboxBlock[]
}

export interface SandboxProjectMeta {
  schemaVersion: number
  id: string
  name: string
  theme: { tokens: Record<string, string> }
  roles: string[]
  data_models: SandboxDataModel[]
  custom_components: SandboxCustomComponent[]
  global_state: Record<string, unknown>
  global_hooks: { name: string; code: string }[]
  menu: SandboxMenuNode[]
  pages: SandboxPage[]
}
