/**
 * Storage definition edits. Every edit is an id-addressed JSON Patch change in the "Storage" area,
 * keyed so repeated tweaks of the same setting collapse into one pending change.
 */
import {
  pointer,
  type Bucket,
  type EnvName,
  type LocalFolder,
  type ObjectStorage,
  type PatchOp,
} from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'

type StorageField = 'name' | 'endpoint' | 'region' | 'tls'
type FolderField = 'quota' | 'access' | 'cleanup' | 'backup'

const show = (v: unknown) => JSON.stringify(v)

export function useStorageEdits() {
  const def = useDefinitionStore()

  /** `add` creates a missing object member (and inverts to `remove`), `replace` overwrites. */
  const setOp = (path: string, value: unknown): PatchOp => ({
    op: def.get(path) === undefined ? 'add' : 'replace',
    path,
    value,
  })

  const objPath = (sid: string, ...rest: (string | number)[]) => pointer('storage', 'object', sid, ...rest)
  const folderPath = (fid: string, ...rest: (string | number)[]) =>
    pointer('storage', 'local', 'folders', fid, ...rest)

  function addStorage(st: ObjectStorage) {
    return def.apply({
      key: `storage.object.${st.id}`,
      area: 'Storage',
      text: `Connected storage “${st.name}” (${st.provider === 'minio' ? 'MinIO' : 'S3'})`,
      machinePath: `+ storage.object.${st.id} = { provider: "${st.provider}", endpoint: "${st.endpoint}" }`,
      ops: [{ op: 'add', path: objPath(st.id), value: st }],
    })
  }

  function removeStorage(st: ObjectStorage) {
    return def.apply({
      key: `storage.object.${st.id}`,
      area: 'Storage',
      text: `Disconnected storage “${st.name}”`,
      machinePath: `- storage.object.${st.id}`,
      ops: [{ op: 'remove', path: objPath(st.id) }],
    })
  }

  function setStorage(st: ObjectStorage, field: StorageField, value: string | boolean) {
    const label = { name: 'name', endpoint: 'endpoint', region: 'region', tls: 'TLS' }[field]
    return def.apply({
      key: `storage.object.${st.id}.${field}`,
      area: 'Storage',
      text:
        field === 'tls'
          ? `${value ? 'Turned on' : 'Turned off'} TLS for “${st.name}”`
          : `Set ${label} of “${st.name}” to ${String(value)}`,
      machinePath: `~ storage.object.${st.id}.${field} = ${show(value)}`,
      ops: [setOp(objPath(st.id, field), value)],
    })
  }

  function setCredentials(st: ObjectStorage, env: EnvName, ref: string) {
    const ops: PatchOp[] = st.credentials
      ? [setOp(objPath(st.id, 'credentials', env), ref)]
      : [{ op: 'add', path: objPath(st.id, 'credentials'), value: { [env]: ref } }]
    return def.apply({
      key: `storage.object.${st.id}.credentials.${env}`,
      area: 'Storage',
      text: `Set ${env} keys for “${st.name}”`,
      machinePath: `~ storage.object.${st.id}.credentials.${env} = ${ref}`,
      ops,
    })
  }

  function addBucket(st: ObjectStorage, bucket: Bucket) {
    return def.apply({
      key: `storage.object.${st.id}.buckets.${bucket.name}`,
      area: 'Storage',
      text: `Added bucket “${bucket.name}” to ${st.name}`,
      machinePath: `+ storage.object.${st.id}.buckets.${bucket.name}`,
      ops: [{ op: 'add', path: objPath(st.id, 'buckets', bucket.name), value: bucket }],
    })
  }

  function removeBucket(st: ObjectStorage, name: string) {
    return def.apply({
      key: `storage.object.${st.id}.buckets.${name}`,
      area: 'Storage',
      text: `Removed bucket “${name}” from ${st.name}`,
      machinePath: `- storage.object.${st.id}.buckets.${name}`,
      ops: [{ op: 'remove', path: objPath(st.id, 'buckets', name) }],
    })
  }

  function setBucket<K extends 'access' | 'versioning' | 'purpose'>(
    st: ObjectStorage,
    name: string,
    field: K,
    value: Bucket[K],
  ) {
    const text =
      field === 'versioning'
        ? `${value ? 'Turned on' : 'Turned off'} versioning on ${name}`
        : field === 'access'
          ? `Set ${name} access to ${String(value)}`
          : `Set ${name} purpose to “${String(value)}”`
    return def.apply({
      key: `storage.object.${st.id}.buckets.${name}.${field}`,
      area: 'Storage',
      text,
      machinePath: `~ storage.object.${st.id}.buckets.${name}.${field} = ${show(value)}`,
      ops: [setOp(objPath(st.id, 'buckets', name, field), value)],
    })
  }

  function addFolder(folder: LocalFolder) {
    return def.apply({
      key: `storage.local.folders.${folder.id}`,
      area: 'Storage',
      text: `Added local folder ${folder.path}/`,
      machinePath: `+ storage.local.folders.${folder.id} = "${folder.path}"`,
      ops: [{ op: 'add', path: folderPath(folder.id), value: folder }],
    })
  }

  function removeFolder(folder: LocalFolder) {
    return def.apply({
      key: `storage.local.folders.${folder.id}`,
      area: 'Storage',
      text: `Removed local folder ${folder.path}/`,
      machinePath: `- storage.local.folders.${folder.id}`,
      ops: [{ op: 'remove', path: folderPath(folder.id) }],
    })
  }

  function setFolder<K extends FolderField>(
    folder: LocalFolder,
    field: K,
    value: LocalFolder[K],
    text: string,
  ) {
    return def.apply({
      key: `storage.local.folders.${folder.id}.${field}`,
      area: 'Storage',
      text,
      machinePath: `~ storage.local.folders.${folder.id}.${field} = ${show(value)}`,
      ops: [setOp(folderPath(folder.id, field), value)],
    })
  }

  return {
    addStorage,
    removeStorage,
    setStorage,
    setCredentials,
    addBucket,
    removeBucket,
    setBucket,
    addFolder,
    removeFolder,
    setFolder,
  }
}
