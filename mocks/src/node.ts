/** Node/Vitest entry: the same handlers behind an msw/node server. */
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export { http, HttpResponse } from 'msw'
export { resetMockDb, db } from './db'

export function createMockServer() {
  return setupServer(...handlers)
}
