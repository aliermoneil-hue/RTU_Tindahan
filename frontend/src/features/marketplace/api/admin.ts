/**
 * ADMIN API: the Users and audit screen.
 * ---------------------------------------------------------------
 * Two lists — accounts and the audit log — plus the one write the screen
 * offers (suspend / ban / restore). Read is open to staff, the writes are
 * administrator-only on the server.
 *
 * Accounts are merged into `db.accounts` by email: the server wins on role,
 * status, verification and join date, while the local record keeps its cart,
 * orders, notifications and listing rows intact. A member the browser has
 * never seen is created through `mkAcct`, so the users table can show every
 * account and not only the ones that sold something in this browser.
 */

import { apiDownload, apiFetch, apiUpload } from '@/common/api/client'
import { mkAcct } from '../constants'
import type { AuditLogEntry, PrototypeAccount } from '../types'

export interface ApiAdminUser {
  id: number
  email: string
  display_name: string
  role: 'visitor' | 'user' | 'office_staff' | 'moderator' | 'administrator'
  member_type: string
  college_name: string | null
  college_code: string | null
  year_level: number | null
  status: 'active' | 'suspended' | 'banned'
  status_note: string
  status_changed_at: string | null
  status_changed_by_name: string | null
  is_verified: boolean
  verified_at: string | null
  date_joined: string
  listing_count: number
  order_count: number
  forum_post_count: number
}

export interface ApiAuditEntry {
  id: number
  actor_email: string
  actor_name: string
  action: string
  target_type: string
  target_id: string
  target_name: string
  note: string
  created_at: string
}

interface ApiPage<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

const PAGE_LIMIT = 40

async function collect<T>(path: string): Promise<T[]> {
  const collected: T[] = []
  let next: string | null = path
  for (let page = 0; page < PAGE_LIMIT && next; page += 1) {
    const data: ApiPage<T> = await apiFetch<ApiPage<T>>(next)
    collected.push(...(data.results ?? []))
    next = data.next ? data.next.slice(data.next.indexOf('/api/v1') + '/api/v1'.length) : null
  }
  return collected
}

export function fetchAdminUsers(params = ''): Promise<ApiAdminUser[]> {
  return collect<ApiAdminUser>(`/admin/users/${params ? `?${params}` : ''}`)
}

export function fetchAuditLog(params = ''): Promise<ApiAuditEntry[]> {
  return collect<ApiAuditEntry>(`/admin/audit/${params ? `?${params}` : ''}`)
}

export function setUserStatus(
  id: number,
  status: 'active' | 'suspended' | 'banned',
  note: string,
): Promise<ApiAdminUser> {
  return apiFetch<ApiAdminUser>(`/admin/users/${id}/status/`, {
    method: 'POST',
    body: { status, note },
  })
}

const STAFF_ROLES = new Set(['office_staff', 'moderator', 'administrator'])

/** The local account shape the users table and its dialog read. */
export function accountFromAdminUser(row: ApiAdminUser): PrototypeAccount {
  const parts = (row.display_name || row.email).trim().split(/\s+/)
  const first = parts[0] || row.email
  const last = parts.slice(1).join(' ')
  return mkAcct({
    email: row.email,
    first,
    last,
    role: STAFF_ROLES.has(row.role) ? 'moderator' : 'student',
    sid: row.email.split('@')[0],
    prog: row.college_name || 'Not set',
    aff: row.member_type.charAt(0).toUpperCase() + row.member_type.slice(1),
    since: row.date_joined,
    verified: row.is_verified,
    status: row.status,
    statusNote: row.status_note || undefined,
    statusBy: row.status_changed_by_name ?? undefined,
    statusAt: row.status_changed_at ?? undefined,
    apiUserId: row.id,
    adminListingCount: row.listing_count,
    adminOrderCount: row.order_count,
    adminPostCount: row.forum_post_count,
  })
}

export function auditEntryFromApi(row: ApiAuditEntry): AuditLogEntry {
  return {
    id: `api:${row.id}`,
    ts: row.created_at,
    by: row.actor_email,
    byName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name,
    note: row.note,
  }
}

/**
 * A consistent copy of the live SQLite database, for an administrator.
 *
 * This is the database itself, not a browser snapshot: the server streams a
 * copy taken through sqlite3's backup API, so it is safe while the site is
 * serving. Restore is a host procedure (stop, swap the file, start), never an
 * upload — replacing a live database from inside the running process is how a
 * demo loses its data.
 */
export function downloadDatabaseBackup() {
  return apiDownload('/admin/backup/')
}

/* ---------------------------------------------------------------- PX-06 ---
 * The JSON backup, an import of one, and the reset. Three administrator-only
 * calls; two of them can overwrite a live demo, so each carries the word the
 * server demands rather than a bare click.
 */

export interface ApiJsonBackupCounts {
  [table: string]: number
}

export interface ApiImportResult {
  written: ApiJsonBackupCounts
  total: number
}

export interface ApiResetResult {
  cleared: ApiJsonBackupCounts
  total: number
  kept: string[]
}

/** The content as JSON. Accounts travel as references; credentials do not. */
export function downloadJsonBackupPath(): string {
  return '/admin/backup/json/'
}

/** Write a backup's rows over the rows that share a key. Deletes nothing. */
export function importJsonBackup(file: File, confirm: string): Promise<ApiImportResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('confirm', confirm)
  return apiUpload<ApiImportResult>('/admin/backup/import/', form)
}

/** Clear what members made; keep accounts, categories and the official store. */
export function resetContent(confirm: string): Promise<ApiResetResult> {
  return apiFetch<ApiResetResult>('/admin/backup/reset/', {
    method: 'POST',
    body: { confirm },
  })
}
