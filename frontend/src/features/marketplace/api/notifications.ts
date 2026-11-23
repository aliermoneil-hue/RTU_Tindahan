/**
 * NOTIFICATIONS API
 * ---------------------------------------------------------------
 * The inbox is the server's: every event that matters (an order moving, a
 * message, a comment, a report decision, a rating, a listing approval) is
 * written where both sides can see it. The topbar keeps reading
 * `currentAccount.notifs`, so this file maps rows into the prototype's shape.
 *
 * Link ids are translated into the UI's own ids: forum posts and conversations
 * carry the `api:` prefix, orders keep their reference. `shop` is a seller
 * destination (My shop) that the prototype did not have.
 */

import { apiFetch } from '@/common/api/client'

import type { NotificationItem, NotificationLink } from '../types'

export interface ApiNotification {
  id: number
  kind: string
  text: string
  link_kind: string
  link_id: string
  read: boolean
  read_at: string | null
  actor_name: string | null
  created_at: string
}

const LINK_KINDS = new Set<NotificationLink['k']>([
  'order',
  'request',
  'txn',
  'listing',
  'message',
  'post',
  'approval',
  'freports',
  'reviews',
  'forum',
  'baostock',
  'baoorders',
  'shop',
])

/** `/notifications/` is unpaginated; the provider caps what it keeps. */
export function fetchNotifications(): Promise<ApiNotification[]> {
  return apiFetch<ApiNotification[]>('/notifications/')
}

export function markNotificationsRead(ids: number[]): Promise<{ marked: number }> {
  return apiFetch('/notifications/read/', { method: 'POST', body: { ids } })
}

export function markAllNotificationsRead(): Promise<{ marked: number }> {
  return apiFetch('/notifications/read/', { method: 'POST', body: { all: true } })
}

function linkFor(row: ApiNotification): NotificationLink | null {
  const kind = row.link_kind as NotificationLink['k']
  if (!row.link_kind || !LINK_KINDS.has(kind)) return null
  let id = row.link_id || undefined
  if (id && (kind === 'message' || kind === 'post' || kind === 'listing')) {
    id = `api:${id}`
  }
  return { k: kind, id }
}

/** Numeric server id behind a UI notification, or null for a local one. */
export function apiNotificationId(id: string | undefined): number | null {
  if (!id || !id.startsWith('api:')) return null
  const value = Number(id.slice(4))
  return Number.isInteger(value) ? value : null
}

export function notificationFromApi(row: ApiNotification): NotificationItem {
  return {
    id: `api:${row.id}`,
    t: row.text,
    read: row.read,
    // `at` drives the "5m ago" label; `ts` is only a fallback.
    at: row.created_at,
    ts: '',
    link: linkFor(row),
  }
}
