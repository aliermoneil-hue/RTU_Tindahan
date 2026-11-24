/**
 * REVIEWS API
 * ---------------------------------------------------------------
 * Ratings are written only against a completed order, so "verified pickup" on
 * the product page means the server checked an order, not that the client said
 * so. The UI keeps reading `db.reviews`; this file maps the server rows onto the
 * existing `ReviewRecord` shape.
 *
 * The prototype keys a review by what it rates:
 *   seller: seller:<order reference>
 *   item:   item:<order reference>:api:<listing slug>
 *
 * The buyer's email is never sent to the browser: the server sends `is_mine`,
 * and only the caller's own rows get their email filled in, which is what the
 * Edit/Delete checks read.
 */

import { apiFetch } from '@/common/api/client'

import { API_ID_PREFIX } from './listings'
import type { ReviewRecord } from '../types'

export interface ApiReview {
  id: number
  kind: 'item' | 'seller'
  order: string
  listing_id: number | null
  listing_slug: string | null
  listing_title: string | null
  listing_is_official: boolean
  seller_email: string
  seller_name: string
  buyer_name: string
  is_mine: boolean
  stars: number
  text: string
  edited: boolean
  /** RR-06: an edited review waiting on a moderator. */
  held?: boolean
  held_reason?: string
  created_at: string
  updated_at: string
}

interface ApiPage<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** Every review, newest first. Public: no token needed. */
export async function fetchReviews(): Promise<ApiReview[]> {
  const collected: ApiReview[] = []
  let path: string | null = '/reviews/'
  for (let page = 0; page < 20 && path; page += 1) {
    const data: ApiPage<ApiReview> = await apiFetch<ApiPage<ApiReview>>(path)
    collected.push(...(data.results ?? []))
    path = data.next
      ? data.next.slice(data.next.indexOf('/api/v1') + '/api/v1'.length)
      : null
  }
  return collected
}

/** Create, or update, the caller's review for one order (and item). */
export function submitReview(
  orderReference: string,
  listingId: number | null,
  stars: number,
  text: string,
): Promise<ApiReview> {
  return apiFetch<ApiReview>('/reviews/', {
    method: 'POST',
    body: {
      order: orderReference,
      listing: listingId,
      stars,
      text,
    },
  })
}

/** Delete one review. The buyer, or a moderator, may do this. */
/** RR-06: a moderator publishes an edited review that screening held. */
export function releaseReview(id: number): Promise<ApiReview> {
  return apiFetch<ApiReview>(`/reviews/${id}/release/`, { method: 'POST' })
}

export function deleteReview(id: number): Promise<void> {
  return apiFetch<void>(`/reviews/${id}/`, { method: 'DELETE' })
}

/** Server row -> the record the product page and order panel already render. */
export function reviewRecordFromApi(row: ApiReview, viewerEmail: string): ReviewRecord {
  const pid = row.listing_slug ? API_ID_PREFIX + row.listing_slug : ''
  return {
    id: String(row.id),
    key: row.kind === 'item' ? `item:${row.order}:${pid}` : `seller:${row.order}`,
    kind: row.kind,
    orderId: row.order,
    pid,
    sellerKey: row.kind === 'item' && row.listing_is_official ? 'official' : row.seller_email,
    sellerName: row.kind === 'item' && row.listing_is_official
      ? 'Official RTU Store'
      : row.seller_name,
    buyerEmail: row.is_mine ? viewerEmail : '',
    buyerName: row.buyer_name,
    stars: row.stars,
    text: row.text,
    ts: Date.parse(row.created_at),
    edited: row.edited ? Date.parse(row.updated_at) : null,
    held: Boolean(row.held),
  }
}
