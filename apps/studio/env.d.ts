/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_USE_MOCKS: string
  readonly VITE_OIDC_AUTHORITY: string
  readonly VITE_OIDC_CLIENT_ID: string
  readonly VITE_CONSTRUCTOR_ORIGIN: string
  /** Platon Sandbox (separate origin) that renders the app for the canvas and Preview. */
  readonly VITE_SANDBOX_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
