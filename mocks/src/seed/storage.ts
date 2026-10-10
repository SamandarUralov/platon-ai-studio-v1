/**
 * Storage mock state for FieldOps: object listings per bucket, local folder files, disk facts and
 * credential hints. File bytes are never stored — only metadata (requirements §3.5).
 */
import type { CredentialHints, StorageFile } from '@platon/definition'

export interface StorageMockState {
  /** Container key → files. `object/<storageId>/<bucket>` or `local/<folderId>`. */
  files: Record<string, StorageFile[]>
  /** Storage id → masked key per environment. */
  hints: Record<string, CredentialHints>
  local: {
    host: string
    os: string
    totalBytes: number
    /** OS, app binaries and anything outside the declared folders. */
    otherBytes: number
    lastBackupAt: string | null
    purposes: Record<string, string>
  }
}

const KB = 1024
const MB = 1024 * KB
const GB = 1024 * MB

/** Small deterministic PRNG so the seed looks the same on every reset. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

function file(key: string, size: number, minutesAgo: number, contentType?: string): StorageFile {
  return { key, size: Math.round(size), modifiedAt: ago(minutesAgo), ...(contentType ? { contentType } : {}) }
}

function photos(): StorageFile[] {
  const r = rng(42)
  const out: StorageFile[] = []
  const shots = ['before', 'after', 'roof-unit', 'boiler-tag', 'panel', 'meter', 'signature']
  for (let wo = 1042; wo >= 1001; wo--) {
    const n = 2 + Math.floor(r() * 3)
    for (let i = 0; i < n; i++) {
      const name = `${shots[Math.floor(r() * shots.length)]}-${String(i + 1).padStart(2, '0')}.jpg`
      out.push(file(`WO-${wo}/${name}`, (1.1 + r() * 2.4) * MB, (1042 - wo) * 260 + i * 3 + 18, 'image/jpeg'))
    }
  }
  return out
}

function documents(): StorageFile[] {
  const r = rng(7)
  const out: StorageFile[] = []
  for (let n = 979; n >= 940; n--)
    out.push(file(`invoices/WO-0${n}.pdf`, (140 + r() * 140) * KB, (979 - n) * 410 + 90, 'application/pdf'))
  for (let n = 1038; n >= 1020; n--)
    out.push(
      file(`reports/WO-${n}-signed.pdf`, (380 + r() * 220) * KB, (1038 - n) * 520 + 135, 'application/pdf'),
    )
  out.push(
    file(
      'templates/invoice-template.docx',
      64 * KB,
      60 * 24 * 40,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),
  )
  return out
}

export function storageSeed(): StorageMockState {
  return {
    files: {
      'object/field_files/fieldops-photos': photos(),
      'object/field_files/fieldops-documents': documents(),
      'local/uploads': [
        file('visit-request-2291.pdf', 1.2 * MB, 22, 'application/pdf'),
        file('roof-unit-photo.jpg', 3.4 * MB, 29, 'image/jpeg'),
        file('site-plan-018.png', 860 * KB, 60 * 26, 'image/png'),
        file('pending/batch-1043.zip', 415 * MB, 60 * 4, 'application/zip'),
      ],
      'local/tmp': [
        file('render-WO-1042.html', 48 * KB, 8, 'text/html'),
        file('inventory-feed.json', 2.1 * MB, 25, 'application/json'),
        file('cache/geo-tiles.bin', 1.19 * GB, 60 * 9),
      ],
      'local/exports': [
        file('work-orders-2026-10.csv', 4.8 * MB, 60 * 6, 'text/csv'),
        file('ops-report-week-40.pdf', 1.1 * MB, 60 * 24 * 3, 'application/pdf'),
        file('archive/work-orders-2026-09.csv', 1.7 * GB, 60 * 24 * 9, 'text/csv'),
        file('archive/work-orders-2026-08.csv', 1.89 * GB, 60 * 24 * 40, 'text/csv'),
      ],
      'local/logs': [
        file('app-2026-10-07.log', 612 * MB, 1, 'text/plain'),
        file('functions-2026-10-07.log', 420 * MB, 1, 'text/plain'),
        file('app-2026-10-06.log', 811 * MB, 60 * 20, 'text/plain'),
      ],
    },
    hints: {
      field_files: { development: 'AKIA…7Q2D', staging: 'AKIA…K91P', production: 'AKIA…3XZA' },
    },
    local: {
      host: 'app-01',
      os: 'Ubuntu 22.04 LTS',
      totalBytes: 80 * GB,
      otherBytes: 11.2 * GB,
      lastBackupAt: ago(60 * 11),
      purposes: {
        uploads: 'Form uploads before they move to object storage',
        tmp: 'Scratch space for functions',
        exports: 'Generated CSV and PDF files',
        logs: 'App and function logs',
      },
    },
  }
}
