import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { resetMockDb } from './db'
import { resetAdminMocks } from './handlers/admin'

/** Starts the mock backend in the browser. Requests outside /api pass through untouched. */
export async function startMocks(): Promise<void> {
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledFrame: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  ;(globalThis as Record<string, unknown>).__platonResetMocks = () => {
    resetMockDb()
    resetAdminMocks()
    location.reload()
  }
}
