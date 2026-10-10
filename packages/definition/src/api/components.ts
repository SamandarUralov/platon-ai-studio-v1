/** Studio API contract — custom components: sandbox files, constructor sessions, AI generation (F14). */
import type { CustomComponent } from '../generated/app-definition'

/** One file in the project's component sandbox (the Vue source tree the Constructor edits). */
export interface SandboxFile {
  /** Path inside the sandbox, e.g. `src/components/JobTimeline.vue`. */
  path: string
  /** `component:<id>` when the file is a custom component registered in the definition. */
  componentId?: string
  /** How the file was created — drives the AI / Vue chip in the file tree. */
  origin: 'ai' | 'code'
  size: number
  updatedAt: string
}

export interface SandboxFilesResponse {
  items: SandboxFile[]
}

/** GET/PUT `/projects/{id}/components/sandbox/file?path=…` (list: `GET …/components/sandbox/files`) */
export interface SandboxFileContent {
  path: string
  content: string
  updatedAt: string
}

export interface SaveSandboxFileRequest {
  content: string
  /** Set when the file is new (PUT creates it). */
  componentId?: string
  origin?: 'ai' | 'code'
}

/**
 * POST `/projects/{id}/components/{componentId}/session` — short-lived token scoped to one project and
 * component, handed to the Constructor through `host:init` (never in the iframe URL).
 */
export interface ComponentSessionResponse {
  token: string
  expiresAt: string
}

/** POST `/projects/{id}/components/generate` */
export interface GenerateComponentRequest {
  prompt: string
  /** PascalCase; empty lets Studio AI name it. */
  name?: string
  folder: 'components' | 'pages'
}

/**
 * The generated component metadata (status `needs_review`) and its `.vue` source. The server writes the
 * file to the sandbox; the client adds the metadata to the definition as a change, so it stays reviewable.
 */
export interface GenerateComponentResponse {
  component: CustomComponent
  source: string
}
