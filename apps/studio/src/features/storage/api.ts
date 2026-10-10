/** Storage server state (stats, credential hints, files) via TanStack Query. Config lives in the definition. */
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import type {
  CredentialsRequest,
  CredentialsResponse,
  EnvName,
  FileListResponse,
  FileUploadResponse,
  LocalStorageStatus,
  ObjectStorageListResponse,
  SignedLinkResponse,
  StorageTestRequest,
  StorageTestResponse,
} from '@platon/definition'
import { http } from '@/services/http'

export const storageKeys = {
  all: (pid: string) => ['storage', pid] as const,
  object: (pid: string) => ['storage', pid, 'object'] as const,
  local: (pid: string) => ['storage', pid, 'local'] as const,
  files: (base: string) => ['storage', 'files', base] as const,
}

const enc = encodeURIComponent

export const objectBase = (pid: string, sid: string, bucket: string) =>
  `/projects/${enc(pid)}/storage/object/${enc(sid)}/buckets/${enc(bucket)}`
export const localBase = (pid: string, folderId: string) =>
  `/projects/${enc(pid)}/storage/local/folders/${enc(folderId)}`

export function useObjectStatus(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => storageKeys.object(toValue(pid))),
    queryFn: async () =>
      (await http.get<ObjectStorageListResponse>(`/projects/${enc(toValue(pid))}/storage/object`)).data.items,
    staleTime: 15_000,
  })
}

export function useLocalStatus(pid: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => storageKeys.local(toValue(pid))),
    queryFn: async () =>
      (await http.get<LocalStorageStatus>(`/projects/${enc(toValue(pid))}/storage/local`)).data,
    staleTime: 15_000,
  })
}

export function useFiles(
  base: MaybeRefOrGetter<string>,
  prefix: MaybeRefOrGetter<string>,
  q: MaybeRefOrGetter<string>,
) {
  return useQuery({
    queryKey: computed(() => [...storageKeys.files(toValue(base)), toValue(prefix), toValue(q)]),
    queryFn: async () =>
      (
        await http.get<FileListResponse>(`${toValue(base)}/files`, {
          params: { prefix: toValue(prefix), q: toValue(q) || undefined },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
}

export async function testSavedStorage(pid: string, sid: string): Promise<StorageTestResponse> {
  return (await http.post<StorageTestResponse>(`/projects/${enc(pid)}/storage/object/${enc(sid)}:test`)).data
}

export async function testNewStorage(pid: string, req: StorageTestRequest): Promise<StorageTestResponse> {
  return (await http.post<StorageTestResponse>(`/projects/${enc(pid)}/storage/object:test`, req)).data
}

export async function saveCredentials(
  pid: string,
  sid: string,
  env: EnvName,
  req: CredentialsRequest,
): Promise<CredentialsResponse> {
  return (
    await http.put<CredentialsResponse>(
      `/projects/${enc(pid)}/storage/object/${enc(sid)}/credentials/${env}`,
      req,
    )
  ).data
}

export async function uploadFiles(base: string, files: File[], prefix: string): Promise<FileUploadResponse> {
  const form = new FormData()
  form.append('prefix', prefix)
  for (const f of files) form.append('file', f, f.name)
  return (await http.post<FileUploadResponse>(`${base}/files`, form, { timeout: 0 })).data
}

export async function deleteFile(base: string, key: string): Promise<void> {
  await http.delete(`${base}/files`, { params: { key } })
}

export async function downloadFile(base: string, key: string): Promise<void> {
  const res = await http.get<Blob>(`${base}/files/content`, { params: { key }, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = key.split('/').pop() || 'file'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function signedLink(base: string, key: string, expiresIn = 3600): Promise<SignedLinkResponse> {
  return (await http.post<SignedLinkResponse>(`${base}/files/link`, { key, expiresIn })).data
}
