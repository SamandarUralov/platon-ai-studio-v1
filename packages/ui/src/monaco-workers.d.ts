// Vite `?worker` imports of Monaco workers resolve through the package's "./*" export.
declare module 'monaco-editor/*?worker' {
  const WorkerCtor: { new (): Worker }
  export default WorkerCtor
}
