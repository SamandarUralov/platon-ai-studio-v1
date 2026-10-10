/** Runtime validation of definitions against the shared JSON Schema (same contract as the backend). */
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import schema from '../schema/app-definition.schema.json'
import type { AppDefinition } from './generated/app-definition'

let compiled: ReturnType<Ajv2020['compile']> | null = null

function validator() {
  if (!compiled) {
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    addFormats(ajv)
    compiled = ajv.compile(schema)
  }
  return compiled
}

export interface SchemaIssue {
  path: string
  message: string
}

export function validateDefinition(
  doc: unknown,
): { ok: true; value: AppDefinition } | { ok: false; issues: SchemaIssue[] } {
  const v = validator()
  if (v(doc)) return { ok: true, value: doc as AppDefinition }
  return {
    ok: false,
    issues: (v.errors ?? []).map((e: ErrorObject) => ({
      path: e.instancePath || '/',
      message: e.message ?? 'invalid',
    })),
  }
}
