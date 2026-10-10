// Generates TypeScript types from the JSON Schemas so frontend and backend never drift.
// Run: pnpm gen:types (CI fails if the output is stale).
import { compile } from 'json-schema-to-typescript'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BANNER = '/* eslint-disable */\n// GENERATED from packages/definition/schema — do not edit. Run `pnpm gen:types`.\n'

for (const [schema, out] of [
  ['app-definition.schema.json', 'app-definition.ts'],
  ['change.schema.json', 'change.ts'],
]) {
  const json = JSON.parse(await readFile(join(root, 'schema', schema), 'utf8'))
  const ts = await compile(json, json.title, {
    bannerComment: BANNER,
    additionalProperties: false,
    unreachableDefinitions: true,
    declareExternallyReferenced: true,
    style: { semi: false, singleQuote: true, printWidth: 110 },
  })
  await writeFile(join(root, 'src/generated', out), ts)
  console.log('wrote', out)
}
