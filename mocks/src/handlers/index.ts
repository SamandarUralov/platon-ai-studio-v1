import type { HttpHandler } from 'msw'
import { coreHandlers } from './core'
import { logicHandlers } from './logic'
import { dataHandlers } from './data'
import { storageHandlers } from './storage'
import { releasesHandlers } from './releases'
import { aiHandlers } from './ai'
import { settingsHandlers } from './settings'
import { adminHandlers } from './admin'
import { componentsHandlers } from './components'
import { recordsHandlers } from './records'

export const handlers: HttpHandler[] = [
  ...coreHandlers,
  ...logicHandlers,
  ...dataHandlers,
  ...storageHandlers,
  ...releasesHandlers,
  ...aiHandlers,
  ...settingsHandlers,
  ...adminHandlers,
  ...componentsHandlers,
  ...recordsHandlers,
]
