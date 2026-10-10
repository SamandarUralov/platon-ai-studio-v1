/** In-memory console for page scripts, shared by Preview (writer) and the Code mode Console tab (reader). */
import { shallowRef } from 'vue'
import type { LogLevel } from './protocol'

export interface ScriptLog {
  id: number
  pageId: string
  at: Date
  level: LogLevel
  text: string
  /** Handler or hook that produced it, e.g. "allWorkOrders.rowClick". */
  src?: string
  role?: string
}

const MAX = 500
let seq = 0
const entries = shallowRef<ScriptLog[]>([])

export function useScriptLogs() {
  function push(e: Omit<ScriptLog, 'id' | 'at'>) {
    entries.value = [...entries.value, { ...e, id: ++seq, at: new Date() }].slice(-MAX)
  }
  function clear(pageId?: string) {
    entries.value = pageId ? entries.value.filter((e) => e.pageId !== pageId) : []
  }
  return { entries, push, clear }
}
