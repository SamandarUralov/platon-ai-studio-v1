/** Mock handlers — storage (requirements §3.5, §6.1). Contract: packages/definition/src/api/storage.ts. */
import { http, HttpResponse, type HttpHandler } from 'msw'
import {
  parseSize,
  type CredentialsRequest,
  type CredentialsResponse,
  type EnvName,
  type FileListResponse,
  type FileUploadResponse,
  type LocalStorageStatus,
  type ObjectStorage,
  type ObjectStorageListResponse,
  type SignedLinkRequest,
  type SignedLinkResponse,
  type StorageFile,
  type StorageTestRequest,
  type StorageTestResponse,
} from '@platon/definition'
import { ext, persist, type ProjectState } from '../db'
import { storageSeed, type StorageMockState } from '../seed/storage'
import { action, api, body, fail, json, latency, withProject } from '../http'

const ENV: EnvName = 'development'
const ENVS: EnvName[] = ['development', 'staging', 'production']

const state = (pid: string) => ext<StorageMockState>(pid, 'storage', storageSeed)

const sum = (files: StorageFile[]) => files.reduce((n, f) => n + f.size, 0)

function mask(accessKey: string): string {
  const tail = accessKey.trim().slice(-4).toUpperCase() || 'KEY1'
  return `${accessKey.trim().slice(0, 4).toUpperCase() || 'AKIA'}…${tail}`
}

function testResult(endpoint: string, access: boolean, buckets: number): StorageTestResponse {
  if (!/^https?:\/\/[^\s/]+/.test(endpoint))
    return { ok: false, message: 'Couldn’t connect. Check the endpoint URL.' }
  if (!access) return { ok: false, message: 'Couldn’t sign in. Add Development keys first.' }
  return {
    ok: true,
    message: `Connected · ${buckets} bucket${buckets === 1 ? '' : 's'} reachable`,
    latencyMs: 18 + Math.round(Math.random() * 40),
  }
}

/** Resolve a file container from route params; error response when it isn't declared in the definition. */
type Container = { key: string; quota: number; signable: boolean; label: string }

function objectContainer(p: ProjectState, sid: string, bucket: string): Container | Response {
  const st = p.definition.storage.object.find((s) => s.id === sid)
  if (!st) return fail(404, 'not_found', `Storage ${sid} not found`)
  if (!st.buckets.some((b) => b.name === bucket))
    return fail(404, 'not_found', `Bucket ${bucket} not found in ${st.name}`)
  return { key: `object/${sid}/${bucket}`, quota: Number.POSITIVE_INFINITY, signable: true, label: bucket }
}

function localContainer(p: ProjectState, fid: string): Container | Response {
  const f = p.definition.storage.local.folders.find((x) => x.id === fid)
  if (!f) return fail(404, 'not_found', `Folder ${fid} is not declared`)
  return { key: `local/${fid}`, quota: parseSize(f.quota), signable: false, label: `${f.path}/` }
}

function listFiles(all: StorageFile[], prefix: string, q: string): FileListResponse {
  if (q) {
    const needle = q.toLowerCase()
    const items = all
      .filter((f) => f.key.toLowerCase().includes(needle))
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    return { env: ENV, prefix, folders: [], items }
  }
  const folders = new Set<string>()
  const items: StorageFile[] = []
  for (const f of all) {
    if (!f.key.startsWith(prefix)) continue
    const rest = f.key.slice(prefix.length)
    const slash = rest.indexOf('/')
    if (slash >= 0) folders.add(prefix + rest.slice(0, slash + 1))
    else items.push(f)
  }
  items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  return { env: ENV, prefix, folders: [...folders].sort(), items }
}

/** Handlers for one file container family; `resolve` maps route params to a container. */
function fileHandlers(
  base: string,
  resolve: (
    p: ProjectState,
    params: Record<string, string | readonly string[] | undefined>,
  ) => Container | Response,
): HttpHandler[] {
  const withContainer = (
    params: Record<string, string | readonly string[] | undefined>,
    fn: (c: Container, files: StorageFile[], p: ProjectState) => Response | Promise<Response>,
  ) =>
    withProject(params.id, (p, pid) => {
      const c = resolve(p, params)
      if (c instanceof Response) return c
      const s = state(pid)
      return fn(c, (s.files[c.key] ??= []), p)
    })

  return [
    http.get(api(`${base}/files`), async ({ params, request }) => {
      await latency()
      const u = new URL(request.url)
      return withContainer(params, (_c, files) =>
        json(listFiles(files, u.searchParams.get('prefix') ?? '', u.searchParams.get('q')?.trim() ?? '')),
      )
    }),

    http.get(api(`${base}/files/content`), async ({ params, request }) => {
      await latency(120)
      const key = new URL(request.url).searchParams.get('key') ?? ''
      return withContainer(params, (c, files) => {
        const f = files.find((x) => x.key === key)
        if (!f) return fail(404, 'not_found', `${key} not found`)
        // Metadata-only mock: hand back a small placeholder instead of the real bytes.
        const text = `Mock content of ${c.label}${f.key} (${f.size} bytes in ${ENV}).\n`
        return new HttpResponse(text, {
          headers: {
            'Content-Type': f.contentType ?? 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${f.key.split('/').pop()}"`,
          },
        })
      })
    }),

    http.post(api(`${base}/files`), async ({ params, request }) => {
      await latency(350)
      let form: FormData
      try {
        form = await request.formData()
      } catch {
        return fail(400, 'validation', 'Send files as multipart/form-data')
      }
      const prefix = String(form.get('prefix') ?? '')
      const uploads = form.getAll('file').filter((v): v is File => typeof v !== 'string')
      if (!uploads.length) return fail(400, 'validation', 'Choose at least one file')
      return withContainer(params, (c, files) => {
        const incoming = uploads.reduce((n, f) => n + f.size, 0)
        const replaced = sum(files.filter((f) => uploads.some((u) => f.key === prefix + u.name)))
        if (sum(files) - replaced + incoming > c.quota)
          return fail(
            507,
            'quota_exceeded',
            `${c.label} is over its size limit. Raise the limit or delete files first.`,
          )
        const now = new Date().toISOString()
        const items = uploads.map((u) => ({
          key: prefix + u.name,
          size: u.size,
          modifiedAt: now,
          ...(u.type ? { contentType: u.type } : {}),
        }))
        for (const it of items) {
          const i = files.findIndex((f) => f.key === it.key)
          if (i >= 0) files.splice(i, 1, it)
          else files.unshift(it)
        }
        persist()
        return json<FileUploadResponse>({ items }, { status: 201 })
      })
    }),

    http.delete(api(`${base}/files`), async ({ params, request }) => {
      await latency(200)
      const key = new URL(request.url).searchParams.get('key') ?? ''
      return withContainer(params, (_c, files) => {
        const before = files.length
        // A key ending with "/" removes the whole prefix.
        const keep = files.filter((f) => (key.endsWith('/') ? !f.key.startsWith(key) : f.key !== key))
        if (keep.length === before) return fail(404, 'not_found', `${key} not found`)
        files.splice(0, files.length, ...keep)
        persist()
        return new HttpResponse(null, { status: 204 })
      })
    }),

    http.post(api(`${base}/files/link`), async ({ params, request }) => {
      await latency(120)
      const req = await body<SignedLinkRequest>(request)
      return withContainer(params, (c, files, p) => {
        if (!c.signable)
          return fail(400, 'not_supported', 'Signed links are only available for object storage')
        if (!files.some((f) => f.key === req.key)) return fail(404, 'not_found', `${req.key} not found`)
        const ttl = req.expiresIn ?? 3600
        const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()
        const sig = Math.random().toString(16).slice(2, 18)
        const [, sid, bucket] = c.key.split('/')
        const st = p.definition.storage.object.find((x) => x.id === sid)
        const host = st ? st.endpoint.replace(/\/+$/, '') : 'https://storage.local'
        const url = `${host}/${bucket}/${encodeURI(req.key)}?X-Amz-Expires=${ttl}&X-Amz-Signature=${sig}`
        return json<SignedLinkResponse>({ url, expiresAt })
      })
    }),
  ]
}

export const storageHandlers: HttpHandler[] = [
  http.get(api('/projects/:id/storage/object'), async ({ params }) => {
    await latency()
    return withProject(params.id, (p, pid) => {
      const s = state(pid)
      const items = p.definition.storage.object.map((st: ObjectStorage) => {
        const buckets = st.buckets.map((b) => {
          const files = s.files[`object/${st.id}/${b.name}`] ?? []
          return { name: b.name, objects: files.length, bytes: sum(files) }
        })
        // Hints only for environments the definition still points at.
        const hints = Object.fromEntries(
          ENVS.filter((e) => st.credentials?.[e]).map((e) => [e, s.hints[st.id]?.[e] ?? 'AKIA…••••']),
        )
        return {
          id: st.id,
          env: ENV,
          buckets,
          totalBytes: buckets.reduce((n, b) => n + b.bytes, 0),
          credentials: hints,
        }
      })
      return json<ObjectStorageListResponse>({ items })
    })
  }),

  // POST /storage/object:test — test a connection that isn't saved yet.
  http.post(api('/projects/:id/storage/:op'), async ({ params, request }) => {
    const [what, verb] = action(params.op)
    if (what !== 'object' || verb !== 'test') return fail(404, 'not_found', 'Unknown storage action')
    await latency(700)
    const req = await body<StorageTestRequest>(request)
    return withProject(params.id, () =>
      json(testResult(req.endpoint ?? '', !!(req.accessKey && req.secretKey), req.bucket ? 1 : 0)),
    )
  }),

  // POST /storage/object/{sid}:test — test a saved connection with its Development keys.
  http.post(api('/projects/:id/storage/object/:sid'), async ({ params }) => {
    const [sid, verb] = action(params.sid)
    if (verb !== 'test') return fail(404, 'not_found', 'Unknown storage action')
    await latency(700)
    return withProject(params.id, (p) => {
      const st = p.definition.storage.object.find((s) => s.id === sid)
      if (!st) return fail(404, 'not_found', `Storage ${sid} not found`)
      return json(testResult(st.endpoint, !!st.credentials?.development, st.buckets.length))
    })
  }),

  http.put(api('/projects/:id/storage/object/:sid/credentials/:env'), async ({ params, request }) => {
    await latency(300)
    const env = String(params.env) as EnvName
    if (!ENVS.includes(env)) return fail(400, 'validation', `Unknown environment ${env}`)
    const req = await body<CredentialsRequest>(request)
    if (!req.accessKey?.trim() || !req.secretKey?.trim())
      return fail(400, 'validation', 'Access key and secret key are required', [
        { path: 'accessKey', problem: 'required' },
      ])
    return withProject(params.id, (_p, pid) => {
      const sid = String(params.sid)
      const s = state(pid)
      const hint = mask(req.accessKey)
      s.hints[sid] = { ...s.hints[sid], [env]: hint }
      persist()
      return json<CredentialsResponse>({ ref: `secret://${sid}/${env}`, hint })
    })
  }),

  http.get(api('/projects/:id/storage/local'), async ({ params }) => {
    await latency()
    return withProject(params.id, (p, pid) => {
      const s = state(pid)
      const folders = p.definition.storage.local.folders.map((f) => {
        const files = s.files[`local/${f.id}`] ?? []
        return {
          id: f.id,
          usedBytes: sum(files),
          files: files.length,
          ...(s.local.purposes[f.id] ? { purpose: s.local.purposes[f.id] } : {}),
        }
      })
      const used = s.local.otherBytes + folders.reduce((n, f) => n + f.usedBytes, 0)
      return json<LocalStorageStatus>({
        env: ENV,
        host: s.local.host,
        os: s.local.os,
        totalBytes: s.local.totalBytes,
        usedBytes: used,
        lastBackupAt: s.local.lastBackupAt,
        folders,
      })
    })
  }),

  ...fileHandlers('/projects/:id/storage/object/:sid/buckets/:bucket', (p, params) =>
    objectContainer(p, String(params.sid), String(params.bucket)),
  ),
  ...fileHandlers('/projects/:id/storage/local/folders/:fid', (p, params) =>
    localContainer(p, String(params.fid)),
  ),
]
