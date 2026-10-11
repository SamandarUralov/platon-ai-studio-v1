/* eslint-disable */
// GENERATED from packages/definition/schema — do not edit. Run `pnpm gen:types`.

/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Id".
 */
export type Id = string
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "BlockType".
 */
export type BlockType =
  | 'header'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'stats'
  | 'table'
  | 'form'
  | 'list'
  | 'detail'
  | 'input'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'date'
  | 'textarea'
  | 'upload'
  | 'bar'
  | 'line'
  | 'donut'
  | 'calendar'
  | 'progress'
  | 'timeline'
  | 'tabs'
  | 'steps'
  | 'alert'
  | 'pagination'
  | 'container'
  | 'section'
  | 'grid'
  | 'columns'
  | 'accordion'
  | 'spacer'
  | 'badge'
  | 'breadcrumb'
  | 'empty'
  | 'segmented'
  | 'richtext'
  | 'kpi'
  | 'area'
  | 'pie'
  | 'hbar'
  | 'stacked'
  | 'gauge'
  | 'funnel'
  | 'scatter'
  | 'custom'
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "DbEngine".
 */
export type DbEngine = 'postgres' | 'mysql' | 'mssql' | 'mongo' | 'redis'
/**
 * Secrets are only stored as secret:// references.
 *
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "SecretRef".
 */
export type SecretRef = string
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "TableFieldType".
 */
export type TableFieldType =
  | 'auto_number'
  | 'text'
  | 'long_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'single_select'
  | 'multi_select'
  | 'workflow_state'
  | 'user_account'
  | 'file'
  | 'link'
  | 'json'
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "StepType".
 */
export type StepType =
  'if' | 'switch' | 'for' | 'set' | 'return' | 'select' | 'execute' | 'http' | 'produce' | 'consume' | 'call'
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "ComponentPropType".
 */
export type ComponentPropType = 'String' | 'Number' | 'Boolean' | 'Array' | 'Object'
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "EnvName".
 */
export type EnvName = 'development' | 'staging' | 'production'

/**
 * One versioned document describing a whole Platon app (requirements §5). Ids are stable snake_case; references use ids, never names.
 */
export interface AppDefinition {
  id: Id
  name: string
  version: number
  settings: AppSettings
  roles: Role[]
  interface: InterfaceLayer
  data: DataLayer
  logic: LogicLayer
  storage: StorageLayer
  workflows: Workflow[]
  /**
   * language code → translation key → text
   */
  translations: {
    [k: string]: {
      [k: string]: string
    }
  }
  components: CustomComponent[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "AppSettings".
 */
export interface AppSettings {
  slug?: string
  defaultLanguage: string
  timezone: string
  languages: string[]
  theme?: AppTheme
  signIn?: ('password' | 'eimzo' | 'ldap' | 'oneid' | 'rsid' | 'keycloak' | 'google')[]
  modules?: string[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "AppTheme".
 */
export interface AppTheme {
  color: string
  mode: 'light' | 'dark' | 'system'
  radius: 'sharp' | 'soft' | 'round'
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Role".
 */
export interface Role {
  id: Id
  name: string
  description?: string
  permissions: string[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "InterfaceLayer".
 */
export interface InterfaceLayer {
  navigation: {
    type: 'sidebar' | 'topbar'
  }
  pages: Page[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Page".
 */
export interface Page {
  id: Id
  name: string
  icon: string
  route: string
  /**
   * Parent page id for nested menu entries.
   */
  parent?: string
  inMenu: boolean
  /**
   * Role ids; empty or missing means every role.
   */
  visibleTo?: Id[]
  permissions?: {
    [k: string]: PagePermission
  }
  script?: PageScript
  lifecycle?: PageLifecycle
  blocks: Block[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "PagePermission".
 */
export interface PagePermission {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "PageScript".
 */
export interface PageScript {
  lang: 'js'
  file?: string
  source: string
  bindings?: string[]
  calls?: string[]
}
/**
 * hook name (onPageInit, onBeforeRender, onPageReady, onBeforeLeave, onPageError, ...) → handlers in order
 *
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "PageLifecycle".
 */
export interface PageLifecycle {
  [k: string]: LifecycleHandler[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "LifecycleHandler".
 */
export interface LifecycleHandler {
  id: string
  kind: 'code' | 'function'
  code?: string
  /**
   * Logic function name when kind = function.
   */
  fn?: string
  args?: {
    [k: string]: string
  }
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Block".
 */
export interface Block {
  id: string
  type: BlockType
  /**
   * Stable camelCase id used by page code (ctx.blocks.<ref>).
   */
  ref: string
  /**
   * Layout row inside the page or the parent cell; blocks with the same row sit side by side in array order.
   */
  row: number
  /**
   * Id of the container block this block sits in (grid, columns, card, tabs, ...). Missing means the page itself.
   */
  parent?: string
  /**
   * Cell of the parent container (grid cell, column, tab, panel). Missing means 0.
   */
  slot?: number
  /**
   * Width in its row on a 12-column grid. Missing means an equal share of what the blocks with a span leave.
   */
  span?: number
  title?: string
  /**
   * Type-specific settings (source, columns, filter, variant, ...).
   */
  props: {}
  style?: BlockStyle
  visibility?: BlockVisibility
  /**
   * Custom component id when type = custom.
   */
  component?: string
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "BlockStyle".
 */
export interface BlockStyle {
  radius?: number
  bg?: string
  color?: string
  pad?: number
  margin?: number
  border?: 'none' | 'light' | 'strong' | 'accent'
  shadow?: 'none' | 'soft' | 'raised'
  width?: 'full' | 'wide' | 'medium' | 'narrow'
  align?: 'left' | 'center' | 'right'
  font?: number
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "BlockVisibility".
 */
export interface BlockVisibility {
  roles?: Id[]
  condition?: VisibilityCondition
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "VisibilityCondition".
 */
export interface VisibilityCondition {
  field: string
  op: 'eq' | 'neq' | 'in' | 'empty' | 'not_empty'
  value: unknown
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "DataLayer".
 */
export interface DataLayer {
  connections: DbConnection[]
  tables: Table[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "DbConnection".
 */
export interface DbConnection {
  id: Id
  name: string
  engine: DbEngine
  role: 'primary' | 'cache' | 'queue' | 'external'
  host?: string
  port?: number
  database?: string
  schema?: string
  ssl?: boolean
  credentials?: EnvSecrets
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "EnvSecrets".
 */
export interface EnvSecrets {
  development?: SecretRef
  staging?: SecretRef
  production?: SecretRef
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Table".
 */
export interface Table {
  id: Id
  name: string
  icon: string
  connection: Id
  physicalName?: string
  /**
   * Redis key sets only.
   */
  ttl?: string
  fields: TableField[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "TableField".
 */
export interface TableField {
  key: string
  name: string
  type: TableFieldType
  req?: boolean
  unique?: boolean
  /**
   * Target table id for link fields.
   */
  link?: string
  options?: string[]
  /**
   * Storage id for file fields.
   */
  storage?: string
  workflow?: string
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "LogicLayer".
 */
export interface LogicLayer {
  packages?: LogicPackage[]
  functions: LogicFunction[]
  apis: Api[]
  crons: Cron[]
  queues: Queue[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "LogicPackage".
 */
export interface LogicPackage {
  id: string
  name: string
  kind: 'functions' | 'apis' | 'crons' | 'queues'
  parent?: string
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "LogicFunction".
 */
export interface LogicFunction {
  id: Id
  name: string
  package?: string
  description?: string
  timeout?: string
  params: TypedField[]
  returns: ReturnType
  steps: Step[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "TypedField".
 */
export interface TypedField {
  name: string
  /**
   * string | number | integer | boolean | date | datetime | enum | object | array<…> | file | any | row<table> | array<table>
   */
  type: string
  req: boolean
  description?: string
  /**
   * Allowed values for enum.
   */
  values?: string[]
  fields?: TypedField[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "ReturnType".
 */
export interface ReturnType {
  type: string
  fields?: TypedField[]
}
/**
 * Branching steps keep their children in `branches` (if: Then/Else, switch: cases + Default, for: Each) so every editor walks one shape.
 *
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Step".
 */
export interface Step {
  id: string
  type: StepType
  note?: string
  config: {
    [k: string]: string
  }
  branches?: StepBranch[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "StepBranch".
 */
export interface StepBranch {
  id: string
  /**
   * Then / Else / case value / Default / Each
   */
  label: string
  steps: Step[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Api".
 */
export interface Api {
  id: Id
  name?: string
  package?: string
  description?: string
  protocol: 'rest' | 'soap' | 'grpc' | 'jsonrpc'
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  /**
   * SOAP service / gRPC service name.
   */
  service?: string
  /**
   * SOAP operation / gRPC or JSON-RPC method name.
   */
  operation?: string
  access: ApiAccess
  request: ApiRequest
  responses: {
    [k: string]: ApiResponse
  }
  cache?: {
    enabled: boolean
    ttl?: string
    varyBy?: string[]
  }
  steps: Step[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "ApiAccess".
 */
export interface ApiAccess {
  type: 'public' | 'basic' | 'token'
  who: 'any' | 'roles'
  roles?: string[]
  perms?: string[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "ApiRequest".
 */
export interface ApiRequest {
  contentType: string
  path: TypedField[]
  headers: TypedField[]
  query: TypedField[]
  body: TypedField[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "ApiResponse".
 */
export interface ApiResponse {
  contentType: string
  fields: TypedField[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Cron".
 */
export interface Cron {
  id: Id
  name: string
  package?: string
  schedule: string
  timezone: string
  enabled: boolean
  steps: Step[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Queue".
 */
export interface Queue {
  id: Id
  name: string
  package?: string
  description?: string
  fields: TypedField[]
  /**
   * Consumer function names.
   */
  consumers: string[]
  settings: QueueSettings
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "QueueSettings".
 */
export interface QueueSettings {
  broker?: 'rabbitmq' | 'kafka'
  concurrency: number
  retries: number
  backoff: 'fixed' | 'exponential'
  timeout: string
  ordered: boolean
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "StorageLayer".
 */
export interface StorageLayer {
  object: ObjectStorage[]
  local: LocalStorage
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "ObjectStorage".
 */
export interface ObjectStorage {
  id: Id
  name: string
  provider: 'minio' | 's3'
  purpose?: 'files' | 'media' | 'backups' | 'exports'
  endpoint: string
  region?: string
  tls?: boolean
  credentials?: EnvSecrets
  buckets: Bucket[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Bucket".
 */
export interface Bucket {
  name: string
  purpose?: string
  access: 'private' | 'signed' | 'public'
  versioning: boolean
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "LocalStorage".
 */
export interface LocalStorage {
  root: string
  folders: LocalFolder[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "LocalFolder".
 */
export interface LocalFolder {
  id: Id
  path: string
  quota: string
  access: 'none' | 'read' | 'rw'
  /**
   * e.g. 7d; empty keeps files forever.
   */
  cleanup?: string
  backup?: {
    enabled: boolean
    target?: string
  }
  /**
   * What the folder is used for (shown in Studio).
   */
  purpose?: string
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "Workflow".
 */
export interface Workflow {
  id: Id
  name: string
  table: Id
  states: {
    id: Id
    name: string
    tone?: string
    final?: boolean
  }[]
  transitions: {
    from: string
    to: string
    label?: string
    roles: string[]
    /**
     * Condition shown to people, e.g. "Hours logged".
     */
    requires?: string
  }[]
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "CustomComponent".
 */
export interface CustomComponent {
  id: string
  kind: 'vue-component'
  name: string
  folder?: 'components' | 'pages'
  file: string
  source: {
    type: 'ai' | 'code'
    prompt?: string
  }
  props: ComponentProp[]
  events: string[]
  status: 'building' | 'needs_review' | 'reviewed' | 'live' | 'out_of_sync'
}
/**
 * This interface was referenced by `AppDefinition`'s JSON-Schema
 * via the `definition` "ComponentProp".
 */
export interface ComponentProp {
  name: string
  label: string
  type: ComponentPropType
  input:
    | 'text'
    | 'textarea'
    | 'select'
    | 'color'
    | 'number'
    | 'slider'
    | 'toggle'
    | 'source'
    | 'list'
    | 'json'
    | 'record'
  required: boolean
  default?: unknown
  options?: string[]
  /**
   * Studio AI may fill this value.
   */
  ai?: boolean
}
