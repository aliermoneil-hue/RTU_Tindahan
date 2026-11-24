/**
 * FORUM API
 * ---------------------------------------------------------------
 * Posts, comments, reactions and reports. The pages keep reading `db.feed`
 * and `db.freports`; this file is the only place that knows Django's field
 * names, and it maps each row back to the prototype's shapes.
 *
 * Server ids carry the `api:` prefix so a local prototype post can never
 * collide with a backend row. The prefix is stripped again on the way out.
 *
 * Two mappings are deliberate compromises:
 *   - reactions are per member on the server but a plain email-keyed map in the
 *     UI, so counts are rebuilt with synthetic keys and the caller's own choice
 *     is keyed by their email (which is what the reaction buttons read);
 *   - author/reporter emails are not exposed publicly. Only the caller's own
 *     rows get their email filled in, which is what the edit/delete/report
 *     ownership checks read.
 */

import { apiFetch } from '@/common/api/client'

import type {
  AnnouncementItem,
  ForumComment,
  ForumPost,
  ForumReport,
  ReactionKey,
} from '../types'

export const FORUM_PREFIX = 'api:'

export interface ApiForumComment {
  id: number
  author_name: string
  author_role: string
  is_mine: boolean
  text: string
  parent: number | null
  deleted: boolean
  hidden: { by: string; ts: string } | null
  moderation_status: 'visible' | 'needs_review'
  screening: ApiForumScreening | null
  created_at: string
  edited_at: string | null
}

export interface ApiForumScreening {
  verdict: 'clean' | 'flagged'
  score: number | null
  reasons: string[]
  provider: string
  model: string
  at: string
}

export interface ApiForumPost {
  id: number
  kind: 'post' | 'student' | 'school' | 'notice'
  topic: string
  title: string
  body: string
  event_date: string | null
  event_start: string | null
  event_end: string | null
  event_place: string
  author_name: string
  author_role: string
  is_mine: boolean
  images: string[]
  pinned: boolean
  hidden: { by: string; ts: string } | null
  moderation_status: 'visible' | 'needs_review'
  screening: ApiForumScreening | null
  comments: ApiForumComment[]
  comment_count: number
  react_counts: Record<string, number>
  my_reaction: string | null
  created_at: string
  edited_at: string | null
}

export interface ApiForumReport {
  id: number
  type: 'post' | 'comment' | 'order'
  post: number | null
  comment: number | null
  order: string | null
  reporter_name: string
  is_mine: boolean
  reason: string
  details: string
  snapshot_title: string
  snapshot_text: string
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned'
  target_name: string
  handled_by_name: string | null
  handled_at: string | null
  action: string
  note: string
  created_at: string
}

interface ApiPage<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** Numeric id from a UI id, or null for a prototype-only row. */
export function apiForumId(id: string | null | undefined): number | null {
  if (!id || !id.startsWith(FORUM_PREFIX)) return null
  const value = Number(id.slice(FORUM_PREFIX.length))
  return Number.isInteger(value) ? value : null
}

async function collect<T>(path: string, maxPages = 20): Promise<T[]> {
  const collected: T[] = []
  let next: string | null = path
  for (let page = 0; page < maxPages && next; page += 1) {
    const data: ApiPage<T> = await apiFetch<ApiPage<T>>(next)
    collected.push(...(data.results ?? []))
    next = data.next ? data.next.slice(data.next.indexOf('/api/v1') + '/api/v1'.length) : null
  }
  return collected
}

export function fetchForumPosts(): Promise<ApiForumPost[]> {
  return collect<ApiForumPost>('/forum/posts/')
}

/**
 * Announcements are notice posts. One model, one moderation path: a notice can
 * be edited or deleted like any other post, and the public feed's Notices tab
 * and the announcements panel read the same rows.
 */
export function fetchNotices(): Promise<ApiForumPost[]> {
  return collect<ApiForumPost>('/forum/posts/?kind=notice')
}

export function announcementFromApi(row: ApiForumPost): AnnouncementItem {
  return {
    id: FORUM_PREFIX + row.id,
    t: row.title || row.body.slice(0, 60) || 'Announcement',
    b: row.body || row.title,
    d: new Date(row.created_at).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
    }),
  }
}

/** Staff get every report; a member gets only their own. */
export function fetchForumReports(): Promise<ApiForumReport[]> {
  return collect<ApiForumReport>('/forum/reports/')
}

export interface ForumPostInput {
  kind?: 'post' | 'student' | 'school' | 'notice'
  topic?: string
  title: string
  body: string
  images?: string[]
  /** CF-05: required by the server when the topic is a selling schedule. */
  event_date?: string | null
  event_start?: string | null
  event_end?: string | null
  event_place?: string | null
}

export function createForumPost(input: ForumPostInput): Promise<ApiForumPost> {
  return apiFetch<ApiForumPost>('/forum/posts/', { method: 'POST', body: input })
}

export function updateForumPost(
  id: number,
  patch: { title?: string; body?: string; topic?: string },
): Promise<ApiForumPost> {
  return apiFetch<ApiForumPost>(`/forum/posts/${id}/`, { method: 'PATCH', body: patch })
}

export function deleteForumPost(id: number): Promise<void> {
  return apiFetch<void>(`/forum/posts/${id}/`, { method: 'DELETE' })
}

export function postForumComment(
  postId: number,
  text: string,
  parent: number | null,
): Promise<ApiForumComment> {
  return apiFetch<ApiForumComment>(`/forum/posts/${postId}/comments/`, {
    method: 'POST',
    body: { text, parent },
  })
}

export function updateForumComment(id: number, text: string): Promise<ApiForumComment> {
  return apiFetch<ApiForumComment>(`/forum/comments/${id}/`, {
    method: 'PATCH',
    body: { text },
  })
}

export function deleteForumComment(id: number): Promise<void> {
  return apiFetch<void>(`/forum/comments/${id}/`, { method: 'DELETE' })
}

export function reactForumPost(
  postId: number,
  key: string,
): Promise<{ my_reaction: string | null; react_counts: Record<string, number> }> {
  return apiFetch(`/forum/posts/${postId}/react/`, { method: 'POST', body: { key } })
}

export type ForumModAction = 'hide' | 'restore' | 'pin' | 'unpin' | 'delete'

export function moderateForumPost(id: number, action: ForumModAction): Promise<void> {
  return apiFetch(`/forum/posts/${id}/moderate/`, { method: 'POST', body: { action } })
}

export function moderateForumComment(
  id: number,
  action: ForumModAction,
): Promise<void> {
  return apiFetch(`/forum/comments/${id}/moderate/`, { method: 'POST', body: { action } })
}

export interface ForumReportInput {
  type: 'post' | 'comment' | 'order'
  post?: number | null
  comment?: number | null
  order?: string | null
  reason: string
  details?: string
}

export function submitForumReportApi(input: ForumReportInput): Promise<ApiForumReport> {
  return apiFetch<ApiForumReport>('/forum/reports/', { method: 'POST', body: input })
}

export function resolveForumReportApi(
  id: number,
  body: { status: 'open' | 'reviewed' | 'dismissed' | 'actioned'; action?: string; note?: string },
): Promise<ApiForumReport> {
  return apiFetch<ApiForumReport>(`/forum/reports/${id}/resolve/`, {
    method: 'POST',
    body,
  })
}

const REACTION_KEYS: ReactionKey[] = ['like', 'love', 'haha', 'wow', 'sad']

function reactionKey(value: string): ReactionKey | null {
  return REACTION_KEYS.includes(value as ReactionKey) ? (value as ReactionKey) : null
}

function reactionsFor(row: ApiForumPost, viewerEmail: string): Record<string, ReactionKey> {
  const reacts: Record<string, ReactionKey> = {}
  const counts = { ...row.react_counts }
  const mine = row.my_reaction ? reactionKey(row.my_reaction) : null
  if (mine) {
    counts[mine] = Math.max(0, (counts[mine] ?? 0) - 1)
    reacts[viewerEmail] = mine
  }
  let n = 0
  for (const [rawKey, count] of Object.entries(counts)) {
    const key = reactionKey(rawKey)
    if (!key) continue
    for (let i = 0; i < count; i += 1) {
      reacts[`member${++n}@forum`] = key
    }
  }
  return reacts
}

function commentFromApi(row: ApiForumComment, viewerEmail: string): ForumComment {
  return {
    id: FORUM_PREFIX + row.id,
    by: row.author_name,
    email: row.is_mine ? viewerEmail : '',
    role: row.author_role,
    text: row.text,
    ts: row.created_at,
    parent: row.parent ? FORUM_PREFIX + row.parent : null,
    edited: row.edited_at ?? undefined,
    deleted: row.deleted,
    hidden: row.hidden ?? undefined,
    held: row.moderation_status === 'needs_review',
    screening: row.screening ?? undefined,
  }
}

export function forumPostFromApi(row: ApiForumPost, viewerEmail: string): ForumPost {
  return {
    id: FORUM_PREFIX + row.id,
    kind: row.kind,
    topic: row.topic,
    title: row.title,
    body: row.body,
    by: row.author_name,
    authorEmail: row.is_mine ? viewerEmail : null,
    ts: row.created_at,
    edited: row.edited_at ?? undefined,
    pinned: row.pinned,
    hidden: row.hidden ?? undefined,
    held: row.moderation_status === 'needs_review',
    screening: row.screening ?? undefined,
    imgs: row.images,
    eventDate: row.event_date ?? null,
    eventStart: row.event_start ?? null,
    eventEnd: row.event_end ?? null,
    eventPlace: row.event_place || null,
    reacts: reactionsFor(row, viewerEmail),
    comments: row.comments.map((c) => commentFromApi(c, viewerEmail)),
  }
}

export function forumReportFromApi(row: ApiForumReport, viewerEmail: string): ForumReport {
  return {
    id: FORUM_PREFIX + row.id,
    type: row.type,
    postId: row.post ? FORUM_PREFIX + row.post : row.order ?? '',
    commentId: row.comment ? FORUM_PREFIX + row.comment : null,
    orderId: row.order,
    reason: row.reason,
    details: row.details,
    reporterEmail: row.is_mine ? viewerEmail : '',
    reporterName: row.reporter_name,
    targetEmail: null,
    targetName: row.target_name,
    snap: {
      title: row.snapshot_title,
      text: row.snapshot_text,
      imgs: 0,
    },
    ts: row.created_at,
    status: row.status,
    handledBy: row.handled_by_name ?? undefined,
    handledAt: row.handled_at ?? undefined,
    action: (row.action || undefined) as ForumReport['action'],
    note: row.note || undefined,
  }
}
