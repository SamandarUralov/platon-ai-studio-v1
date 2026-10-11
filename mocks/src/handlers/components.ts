/** Mock handlers — custom components: sandbox files, constructor sessions, AI generation, community (F14). */
import { http, type HttpHandler } from 'msw'
import type {
  CommunityComponentsResponse,
  ComponentSessionResponse,
  GenerateComponentRequest,
  GenerateComponentResponse,
  InstallCommunityComponentResponse,
  SandboxFile,
  SandboxFileContent,
  SandboxFilesResponse,
  SaveSandboxFileRequest,
} from '@platon/definition'
import { ext, persist } from '../db'
import { api, body, fail, json, latency, withProject } from '../http'
import {
  communityCatalog,
  generateComponent,
  installCommunity,
  sandboxSeed,
  type SandboxEntry,
} from '../seed/components'

const sandbox = (pid: string) => ext<SandboxEntry[]>(pid, 'componentSandbox', sandboxSeed)
const meta = ({ content: _c, ...f }: SandboxEntry): SandboxFile => f
const SAFE_PATH = /^src\/(components|pages)\/[A-Z][A-Za-z0-9]*\.vue$/

function pathOf(request: Request): string {
  return new URL(request.url).searchParams.get('path') ?? ''
}

export const componentsHandlers: HttpHandler[] = [
  http.get(api('/projects/:id/components/sandbox/files'), async ({ params }) => {
    await latency(120)
    return withProject(params.id, (_p, pid) => json<SandboxFilesResponse>({ items: sandbox(pid).map(meta) }))
  }),

  http.get(api('/projects/:id/components/sandbox/file'), async ({ params, request }) => {
    await latency(120)
    return withProject(params.id, (_p, pid) => {
      const path = pathOf(request)
      const f = sandbox(pid).find((x) => x.path === path)
      if (!f) return fail(404, 'not_found', `${path} is not in the sandbox`)
      return json<SandboxFileContent>({ path: f.path, content: f.content, updatedAt: f.updatedAt })
    })
  }),

  http.put(api('/projects/:id/components/sandbox/file'), async ({ params, request }) => {
    await latency(160)
    const req = await body<SaveSandboxFileRequest>(request)
    return withProject(params.id, (_p, pid) => {
      const path = pathOf(request)
      if (!SAFE_PATH.test(path))
        return fail(
          400,
          'validation',
          'Files live in src/components or src/pages and use a PascalCase .vue name',
          [{ path: 'path', problem: 'pattern' }],
        )
      if (typeof req.content !== 'string')
        return fail(400, 'validation', 'content is required', [{ path: 'content', problem: 'required' }])
      if (req.content.length > 200_000) return fail(413, 'too_large', 'The file is larger than 200 KB')
      const files = sandbox(pid)
      const now = new Date().toISOString()
      let f = files.find((x) => x.path === path)
      if (f) Object.assign(f, { content: req.content, size: req.content.length, updatedAt: now })
      else {
        f = {
          path,
          componentId: req.componentId,
          origin: req.origin ?? 'code',
          size: req.content.length,
          updatedAt: now,
          content: req.content,
        }
        files.push(f)
      }
      persist()
      return json<SandboxFileContent>({ path: f.path, content: f.content, updatedAt: f.updatedAt })
    })
  }),

  http.post(api('/projects/:id/components/generate'), async ({ params, request }) => {
    const req = await body<GenerateComponentRequest>(request)
    await latency(900)
    return withProject(params.id, (p, pid) => {
      if (!req.prompt?.trim())
        return fail(400, 'validation', 'Describe the component first', [
          { path: 'prompt', problem: 'required' },
        ])
      if (req.name && !/^[A-Z][A-Za-z0-9]*$/.test(req.name))
        return fail(400, 'validation', 'Use PascalCase for the name', [{ path: 'name', problem: 'pattern' }])
      const taken = p.definition.components.map((c) => c.name)
      const res = generateComponent(
        req.prompt.trim(),
        req.name || undefined,
        req.folder === 'pages' ? 'pages' : 'components',
        taken,
      )
      const files = sandbox(pid)
      const now = new Date().toISOString()
      const entry: SandboxEntry = {
        path: res.component.file,
        componentId: res.component.id,
        origin: 'ai',
        size: res.source.length,
        updatedAt: now,
        content: res.source,
      }
      const i = files.findIndex((x) => x.path === entry.path)
      if (i >= 0) files[i] = entry
      else files.push(entry)
      persist()
      return json<GenerateComponentResponse>(res)
    })
  }),

  http.post(api('/projects/:id/components/:cid/session'), async ({ params }) => {
    await latency(80)
    return withProject(params.id, (p, pid) => {
      const cid = `component:${String(params.cid)}`
      if (!p.definition.components.some((c) => c.id === cid))
        return fail(404, 'not_found', `Component ${cid} not found`)
      const rnd = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('')
      return json<ComponentSessionResponse>({
        token: `cst_${pid}_${rnd}`,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
    })
  }),

  http.get(api('/community/components'), async ({ request }) => {
    await latency(200)
    const q = new URL(request.url).searchParams.get('q') ?? ''
    return json<CommunityComponentsResponse>({ items: communityCatalog(q) })
  }),

  http.post(api('/projects/:id/components/community/:cid/install'), async ({ params }) => {
    await latency(400)
    return withProject(params.id, (p, pid) => {
      // Unsaved installs only exist in the sandbox so far, so their file names count as taken too.
      const taken = [
        ...p.definition.components.map((c) => c.name),
        ...sandbox(pid).map((f) => f.path.replace(/^.*\/|\.vue$/g, '')),
      ]
      const res = installCommunity(String(params.cid), taken)
      if (!res) return fail(404, 'not_found', `Community component ${String(params.cid)} not found`)
      sandbox(pid).push({
        path: res.component.file,
        componentId: res.component.id,
        origin: 'code',
        size: res.source.length,
        updatedAt: new Date().toISOString(),
        content: res.source,
      })
      persist()
      return json<InstallCommunityComponentResponse>(res)
    })
  }),
]
