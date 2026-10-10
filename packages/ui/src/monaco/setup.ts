/**
 * Monaco bootstrap. Imported lazily by PCodeEditor so the ~3 MB editor never lands in the initial bundle.
 */
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

let ready = false

export function setupMonaco(): typeof monaco {
  if (ready) return monaco
  ready = true
  self.MonacoEnvironment = {
    getWorker(_id: string, label: string) {
      if (label === 'json') return new JsonWorker()
      if (label === 'typescript' || label === 'javascript') return new TsWorker()
      return new EditorWorker()
    },
  }

  // Colours mirror the --p-code-* tokens; Monaco cannot read CSS variables.
  monaco.editor.defineTheme('platon-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6c6f93', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'string', foreground: 'a5d6a7' },
      { token: 'number', foreground: 'f2b45a' },
      { token: 'type', foreground: '7cc3ef' },
      { token: 'identifier', foreground: 'e3e5f5' },
      { token: 'delimiter', foreground: '9a9cc0' },
    ],
    colors: {
      'editor.background': '#15161f',
      'editor.foreground': '#e3e5f5',
      'editorLineNumber.foreground': '#4b4d68',
      'editorLineNumber.activeForeground': '#9a9cc0',
      'editor.lineHighlightBackground': '#1b1c2b',
      'editor.selectionBackground': '#2a2c44',
      'editorCursor.foreground': '#9aa3ff',
      'editorWidget.background': '#1b1c2b',
      'editorWidget.border': '#2a2c44',
      'editorSuggestWidget.background': '#1b1c2b',
      'editorSuggestWidget.selectedBackground': '#2a2c44',
    },
  })

  const ts = monaco.typescript
  ts.javascriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    checkJs: true,
    noLib: false,
  })
  ts.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false })
  return monaco
}

export type Monaco = typeof monaco
