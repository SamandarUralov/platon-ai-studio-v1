import { describe, expect, it } from 'vitest'
import { parseSize, type AppDefinition } from '@platon/definition'
import { fieldopsDefinition } from '@platon/mocks'
import {
  backedUpFolders,
  breadcrumbs,
  bucketNameError,
  cleanupDays,
  fileIcon,
  folderPathError,
  isNearFull,
  missingCredentials,
  newStorageId,
  normalizeBucketName,
  normalizeFolderPath,
  usagePct,
  usedBy,
} from '../utils'

describe('storage utils', () => {
  it('parses sizes and treats unknown limits as unlimited', () => {
    expect(parseSize('5 GB')).toBe(5 * 1024 ** 3)
    expect(parseSize('1.5MB')).toBe(Math.round(1.5 * 1024 ** 2))
    expect(parseSize('No limit')).toBe(Number.POSITIVE_INFINITY)
  })

  it('computes usage and the 80% warning', () => {
    expect(usagePct(1, 4)).toBe(25)
    expect(usagePct(10, 4)).toBe(100)
    expect(usagePct(10, Number.POSITIVE_INFINITY)).toBe(0)
    expect(isNearFull(79, 100)).toBe(false)
    expect(isNearFull(80, 100)).toBe(true)
    expect(isNearFull(80, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('reads cleanup rules', () => {
    expect(cleanupDays('7d')).toBe(7)
    expect(cleanupDays('')).toBeNull()
    expect(cleanupDays(undefined)).toBeNull()
  })

  it('validates bucket names', () => {
    expect(bucketNameError('')).toBe('required')
    expect(bucketNameError('ab')).toBe('length')
    expect(bucketNameError('Field_Files')).toBe('chars')
    expect(bucketNameError('-photos')).toBe('edges')
    expect(bucketNameError('photos', ['photos'])).toBe('taken')
    expect(bucketNameError('fieldops-invoices')).toBeNull()
    expect(normalizeBucketName('New Invoices_2026')).toBe('new-invoices-2026')
  })

  it('validates folder paths', () => {
    expect(folderPathError('imports')).toBeNull()
    expect(folderPathError('imports/csv')).toBeNull()
    expect(folderPathError('../etc')).toBe('chars')
    expect(folderPathError('uploads', ['uploads'])).toBe('taken')
    expect(normalizeFolderPath('/Supplier CSV//in')).toBe('supplier-csv/in')
  })

  it('makes unique snake_case ids', () => {
    expect(newStorageId('Invoices archive', [])).toBe('invoices_archive')
    expect(newStorageId('Field files', ['field_files'])).toBe('field_files2')
    expect(newStorageId('!!!', [], 'folder')).toBe('folder')
  })

  it('splits prefixes into breadcrumbs', () => {
    expect(breadcrumbs('')).toEqual([])
    expect(breadcrumbs('WO-1042/photos/')).toEqual([
      { label: 'WO-1042', prefix: 'WO-1042/' },
      { label: 'photos', prefix: 'WO-1042/photos/' },
    ])
  })

  it('picks file icons', () => {
    expect(fileIcon('a/b.JPG')).toBe('file-image')
    expect(fileIcon('report.csv')).toBe('file-spreadsheet')
    expect(fileIcon('blob', 'image/png')).toBe('file-image')
    expect(fileIcon('blob')).toBe('file')
  })

  it('finds file fields, functions and backups that use a storage', () => {
    const def = fieldopsDefinition()
    const withFn: AppDefinition = {
      ...def,
      logic: {
        ...def.logic,
        functions: [
          ...def.logic.functions,
          {
            id: 'archive_photos',
            name: 'archivePhotos',
            params: [],
            returns: { type: 'any' } as never,
            steps: [
              { id: 's1', type: 'set' as never, config: { value: '"s3://field_files/fieldops-photos/"' } },
            ],
          },
          {
            id: 'other',
            name: 'other',
            params: [],
            returns: { type: 'any' } as never,
            steps: [{ id: 's1', type: 'set' as never, config: { value: 's3://field_files_old/x' } }],
          },
        ],
      },
    }
    const used = usedBy(withFn, 'field_files')
    expect(used.filter((u) => u.kind === 'field').map((u) => u.label)).toContain('Work orders → Photos')
    expect(used.filter((u) => u.kind === 'function').map((u) => u.functionId)).toEqual(['archive_photos'])
    expect(backedUpFolders(def, 'field_files').map((f) => f.id)).toEqual(['uploads', 'exports'])
    expect(missingCredentials(def.storage.object[0]!)).toEqual([])
    expect(missingCredentials({})).toEqual(['development', 'staging', 'production'])
  })
})
