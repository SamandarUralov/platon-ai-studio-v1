import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMockServer, db, resetMockDb } from '@platon/mocks/node'
import { http } from '@/services/http'
import type { FileListResponse, LocalStorageStatus, ObjectStorageListResponse } from '@platon/definition'
import {
  deleteFile,
  localBase,
  objectBase,
  saveCredentials,
  signedLink,
  testNewStorage,
  testSavedStorage,
  uploadFiles,
} from '../api'

const server = createMockServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())
beforeEach(() => resetMockDb())

const P = 'fieldops'
const list = async (base: string, prefix = '', q = '') =>
  (await http.get<FileListResponse>(`${base}/files`, { params: { prefix, q: q || undefined } })).data

describe('storage mock API', () => {
  it('reports bucket stats and masked key hints only', async () => {
    const { items } = (await http.get<ObjectStorageListResponse>(`/projects/${P}/storage/object`)).data
    const ff = items.find((s) => s.id === 'field_files')!
    expect(ff.buckets.find((b) => b.name === 'fieldops-photos')!.objects).toBeGreaterThan(50)
    expect(ff.credentials.development).toMatch(/…/)
  })

  it('lists prefixes as folders and searches across them', async () => {
    const base = objectBase(P, 'field_files', 'fieldops-photos')
    const root = await list(base)
    expect(root.items).toEqual([])
    expect(root.folders).toContain('WO-1042/')
    const inside = await list(base, 'WO-1042/')
    expect(inside.folders).toEqual([])
    expect(inside.items.every((f) => f.key.startsWith('WO-1042/'))).toBe(true)
    const found = await list(base, '', 'boiler')
    expect(found.items.length).toBeGreaterThan(0)
    expect(found.items.every((f) => f.key.includes('boiler'))).toBe(true)
  })

  it('uploads, signs and deletes files', async () => {
    const base = objectBase(P, 'field_files', 'fieldops-documents')
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
    const up = await uploadFiles(base, [file], 'invoices/')
    expect(up.items[0]!.key).toBe('invoices/note.txt')
    const link = await signedLink(base, 'invoices/note.txt')
    expect(link.url).toContain('X-Amz-Expires=3600')
    expect(new Date(link.expiresAt).getTime() - Date.now()).toBeGreaterThan(3500_000)
    await deleteFile(base, 'invoices/note.txt')
    expect((await list(base, 'invoices/')).items.some((f) => f.key === 'invoices/note.txt')).toBe(false)
  })

  it('enforces local folder quotas and has no signed links there', async () => {
    const base = localBase(P, 'logs')
    const small = new File(['x'.repeat(1024)], 'more.log')
    await expect(uploadFiles(base, [small], '')).resolves.toBeTruthy()
    // logs/ holds ~1.8 GB; lowering its limit makes the next upload overflow.
    db.state[P]!.definition.storage.local.folders.find((f) => f.id === 'logs')!.quota = '1 GB'
    await expect(uploadFiles(base, [small], '')).rejects.toMatchObject({ status: 507 })
    const [first] = (await list(base)).items
    await expect(signedLink(base, first!.key)).rejects.toMatchObject({ status: 400 })
    const disk = (await http.get<LocalStorageStatus>(`/projects/${P}/storage/local`)).data
    expect(disk.folders.find((f) => f.id === 'logs')!.usedBytes).toBeGreaterThan(1.7 * 1024 ** 3)
    expect(disk.usedBytes).toBeLessThan(disk.totalBytes)
  })

  it('rejects undeclared containers', async () => {
    await expect(list(localBase(P, 'etc'))).rejects.toMatchObject({ status: 404 })
    await expect(list(objectBase(P, 'field_files', 'nope'))).rejects.toMatchObject({ status: 404 })
  })

  it('tests connections and stores credentials as references', async () => {
    expect((await testSavedStorage(P, 'field_files')).ok).toBe(true)
    expect(
      (await testNewStorage(P, { provider: 'minio', endpoint: 'nope', accessKey: 'a', secretKey: 'b' })).ok,
    ).toBe(false)
    expect(
      (
        await testNewStorage(P, {
          provider: 'minio',
          endpoint: 'https://m.local:9000',
          accessKey: 'a',
          secretKey: 'b',
        })
      ).ok,
    ).toBe(true)
    const r = await saveCredentials(P, 'field_files', 'staging', {
      accessKey: 'AKIANEWKEY1234',
      secretKey: 's3cr3t',
    })
    expect(r).toEqual({ ref: 'secret://field_files/staging', hint: 'AKIA…1234' })
    expect(JSON.stringify(r)).not.toContain('s3cr3t')
  })
})
