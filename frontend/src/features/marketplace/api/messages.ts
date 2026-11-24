/**
 * MESSAGES API — buyer ↔ seller threads.
 *
 * The prototype kept conversations in `db.conv`, which is per browser, so a
 * reply never crossed to the other person. These endpoints are the source of
 * truth; `mergeApiConversations` folds them into the snapshot the Messages page
 * already renders.
 */

import { apiFetch } from '@/common/api/client'

import type { ChatMessage, Conversation, MessageRef } from '../types'

export const MESSAGE_ID_PREFIX = 'api:'

export interface ApiMessage {
  id: number
  sender: number | null
  sender_email: string | null
  sender_name: string | null
  body: string
  created_at: string
  read_at: string | null
}

export interface ApiConversation {
  id: number
  buyer: number
  buyer_name: string
  buyer_email: string
  seller: number
  seller_name: string
  seller_email: string
  listing: number | null
  listing_title: string | null
  listing_slug: string | null
  messages: ApiMessage[]
  unread: number
  created_at: string
  updated_at: string
}

interface ApiPage<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export async function fetchConversations(): Promise<ApiConversation[]> {
  const data = await apiFetch<ApiPage<ApiConversation>>('/conversations/')
  return data.results ?? []
}

/** Open, or find, the thread with one other member. */
export async function openConversation(input: {
  sellerEmail?: string
  buyerEmail?: string
  listingSlug?: string | null
}): Promise<ApiConversation> {
  return apiFetch<ApiConversation>('/conversations/', {
    method: 'POST',
    body: {
      ...(input.sellerEmail ? { seller_email: input.sellerEmail } : {}),
      ...(input.buyerEmail ? { buyer_email: input.buyerEmail } : {}),
      ...(input.listingSlug ? { listing: input.listingSlug } : {}),
    },
  })
}

export async function sendMessage(
  conversationId: number,
  body: string,
): Promise<ApiMessage> {
  return apiFetch<ApiMessage>(`/conversations/${conversationId}/messages/`, {
    method: 'POST',
    body: { body },
  })
}

export async function markConversationRead(
  conversationId: number,
): Promise<ApiConversation> {
  return apiFetch<ApiConversation>(`/conversations/${conversationId}/read/`, {
    method: 'POST',
  })
}

/** The numeric id behind a prototype conversation id (`api:cv-12`). */
export function apiConversationId(conversationId: string): number | null {
  if (!conversationId.startsWith(MESSAGE_ID_PREFIX)) return null
  const value = Number(conversationId.slice(MESSAGE_ID_PREFIX.length).replace(/^cv-/, ''))
  return Number.isFinite(value) ? value : null
}

export function toChatMessage(dto: ApiMessage): ChatMessage {
  return {
    id: `${MESSAGE_ID_PREFIX}m${dto.id}`,
    from: dto.sender_email || 'unknown',
    name: dto.sender_name || dto.sender_email || 'Member',
    staff: false,
    text: dto.body,
    ts: dto.created_at,
    ref: null,
  }
}

export function toConversation(dto: ApiConversation, me?: string | null): Conversation {
  const ref: MessageRef = dto.listing_slug
    ? {
        type: 'product',
        id: `api:${dto.listing_slug}`,
        name: dto.listing_title || 'Listing',
        pid: `api:${dto.listing_slug}`,
      }
    : {
        type: 'order',
        id: '',
        name: 'Direct message',
        pid: null,
      }
  const msgs = dto.messages.map(toChatMessage)
  return {
    id: `${MESSAGE_ID_PREFIX}cv-${dto.id}`,
    buyer: dto.buyer_email,
    buyerName: dto.buyer_name,
    seller: dto.seller_email,
    sellerName: dto.seller_name,
    ref,
    msgs,
    last: msgs.length ? msgs[msgs.length - 1].ts : dto.created_at,
    created: dto.created_at,
    // Translate the server's unread count into the prototype's per-email map,
    // or the badge would never clear: everything would look unread.
    seen:
      me && dto.unread <= msgs.length
        ? { [me]: msgs.length - dto.unread }
        : {},
  }
}

/** Replace the server-backed threads, keep anything still prototype-local. */
export function mergeApiConversations<T extends { conv: Conversation[] }>(
  prev: T,
  conversations: ApiConversation[],
  me?: string | null,
): T {
  const pairs = new Set(
    conversations.map((dto) => [dto.buyer_email, dto.seller_email].sort().join('|')),
  )
  const local = prev.conv.filter((c) => {
    if (c.id.startsWith(MESSAGE_ID_PREFIX)) return false
    // A thread with no other side cannot be delivered: it is either the old
    // checkout's leftover or the prototype's "RTU Pasig Campus Store" chat.
    // Keeping it in the list made one request look like two different people.
    if (!c.seller) return false
    // A prototype duplicate of a pair the server already carries would split
    // the conversation in two.
    const pair = [c.buyer, c.seller || ''].sort().join('|')
    return !pairs.has(pair)
  })
  return {
    ...prev,
    conv: [...conversations.map((dto) => toConversation(dto, me)), ...local],
  }
}

/* ---------------------------------------------------------------
 * MS-04 and MS-05: reporting a conversation, and the queue a
 * moderator reads. The report is the only door onto a private
 * thread, and it carries one message — never the thread.
 * ------------------------------------------------------------- */

export type MessageReportReason =
  | 'harassment'
  | 'scam'
  | 'off_platform'
  | 'prohibited'
  | 'spam'
  | 'other'

export const MESSAGE_REPORT_REASONS: Array<[MessageReportReason, string]> = [
  ['harassment', 'Harassment or threats'],
  ['scam', 'Scam or fraud'],
  ['off_platform', 'Payment outside the platform'],
  ['prohibited', 'Prohibited item or service'],
  ['spam', 'Spam'],
  ['other', 'Something else'],
]

export interface ApiMessageReport {
  id: number
  reason: MessageReportReason
  reason_display: string
  details: string
  status: 'open' | 'dismissed' | 'actioned'
  status_display: string
  action: 'dismiss' | 'warn' | 'suspend' | ''
  note: string
  reporter_name: string
  reported_user_name: string
  handled_by_name: string
  handled_at: string | null
  is_mine: boolean
  is_thread_report: boolean
  /** The reported message, copied when the report was filed. Nothing else. */
  reported_messages: Array<{ body: string; sent_at: string | null; sender: string }>
  created_at: string
}

export function reportConversation(
  conversationId: number,
  input: { reason: MessageReportReason; details?: string; message?: number },
): Promise<ApiMessageReport> {
  return apiFetch<ApiMessageReport>(`/conversations/${conversationId}/report/`, {
    method: 'POST',
    body: input,
  })
}

export async function fetchMessageReports(
  status?: 'open' | 'dismissed' | 'actioned',
): Promise<ApiMessageReport[]> {
  const path = `/message-reports/${status ? `?status=${status}` : ''}`
  const data = await apiFetch<
    ApiMessageReport[] | { results: ApiMessageReport[] }
  >(path)
  return Array.isArray(data) ? data : data.results
}

export function resolveMessageReport(
  id: number,
  action: 'dismiss' | 'warn' | 'suspend',
  note: string,
): Promise<ApiMessageReport> {
  return apiFetch<ApiMessageReport>(`/message-reports/${id}/resolve/`, {
    method: 'POST',
    body: { action, note },
  })
}
