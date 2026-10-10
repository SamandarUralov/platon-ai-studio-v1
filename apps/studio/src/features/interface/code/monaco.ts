/**
 * Monaco glue for page code: one shared `ctx` typings lib (the current page's blocks + functions)
 * and problem markers. Monaco is passed in from PCodeEditor's `ready` event, so it stays lazy.
 */
import type * as Monaco from 'monaco-editor'
import type { Problem } from '@platon/definition'

let lib: Monaco.IDisposable | null = null
let libText = ''

export function setCtxLib(monaco: typeof Monaco, text: string) {
  if (text === libText && lib) return
  lib?.dispose()
  libText = text
  const ts = monaco.typescript
  ts.javascriptDefaults.setCompilerOptions({
    ...ts.javascriptDefaults.getCompilerOptions(),
    allowNonTsExtensions: true,
    checkJs: false,
    target: ts.ScriptTarget.ES2020,
  })
  lib = ts.javascriptDefaults.addExtraLib(text, 'file:///platon/page-ctx.d.ts')
}

export function setProblemMarkers(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel | null | undefined,
  problems: Problem[],
) {
  if (!model) return
  monaco.editor.setModelMarkers(
    model,
    'platon',
    problems
      .filter((p) => p.line)
      .map((p) => {
        const line = Math.min(p.line!, model.getLineCount())
        return {
          severity:
            p.severity === 'error'
              ? monaco.MarkerSeverity.Error
              : p.severity === 'warning'
                ? monaco.MarkerSeverity.Warning
                : monaco.MarkerSeverity.Info,
          message: p.message,
          startLineNumber: line,
          endLineNumber: line,
          startColumn: p.column ?? model.getLineFirstNonWhitespaceColumn(line),
          endColumn: model.getLineMaxColumn(line),
        }
      }),
  )
}
