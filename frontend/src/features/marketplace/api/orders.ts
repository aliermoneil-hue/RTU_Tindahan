/**
 * ORDERS API — student-to-student requests.
 *
 * The Official Store uses tickets (api/store.ts). Every other seller uses these
 * orders, which live on the server so the seller actually receives the request:
 * before this existed the request was written into the buyer's own browser and
 * never left it.
 */

import { apiFetch } from '@/common/api/client'

import type { OrderLine, OrderRecord } from '../types'
import { API_ID_PREFIX } from './listings'

export interface ApiOrderLine {
  id: number
  listing: number
  listing_slug: string
  title: string
  quantity: number
  unit_price: string
  line_total: string
}

export type ApiOrderStatus =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'completed'
  | 'cancelled'

export interface ApiOrder {
  id: number
  reference: string
  buyer: number
  buyer_name: string
  buyer_email: string
  seller: number
  seller_name: string
  seller_email: string
  status: ApiOrderStatus
  status_display: string
  fulfillment: 'pickup' | 'delivery' | 'both'
  meetup_place: string
  meetup_date: string | null
  meetup_time: string
  note: string
  lines: ApiOrderLine[]
  total_amount: string
  is_open: boolean
  decided_at: string | null
  created_at: string
  updated_at: string
}

interface ApiPage<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** Mine, both as buyer and as seller (or narrowed with `role`). */
export async function fetchOrders(role?: 'buyer' | 'seller'): Promise<ApiOrder[]> {
  const collected: ApiOrder[] = []
  let path: string | null = role ? `/orders/?role=${role}` : '/orders/'
  for (let page = 0; page < 10 && path; page += 1) {
    const data: ApiPage<ApiOrder> = await apiFetch<ApiPage<ApiOrder>>(path)
    collected.push(...(data.results ?? []))
    path = data.next
      ? data.next.slice(data.next.indexOf('/api/v1') + '/api/v1'.length)
      : null
  }
  return collected
}

export async function createOrder(input: {
  lines: Array<{ listing: number; quantity: number }>
  fulfillment?: 'pickup' | 'delivery' | 'both'
  meetupPlace?: string
  meetupDate?: string | null
  meetupTime?: string
  note?: string
}): Promise<ApiOrder> {
  return apiFetch<ApiOrder>('/orders/', {
    method: 'POST',
    body: {
      lines: input.lines,
      fulfillment: input.fulfillment ?? 'pickup',
      meetup_place: input.meetupPlace ?? '',
      meetup_date: input.meetupDate || null,
      meetup_time: input.meetupTime ?? '',
      note: input.note ?? '',
    },
  })
}

/** Seller: accepted / declined / completed. Buyer: cancelled. */
export async function transitionOrder(
  reference: string,
  status: ApiOrderStatus,
): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${encodeURIComponent(reference)}/transition/`, {
    method: 'POST',
    body: { status },
  })
}

/** The server's status, in the two vocabularies the order screens render. */
export function orderStatusFromApi(row: ApiOrder): {
  status: OrderRecord['status']
  tab: OrderRecord['tab']
} {
  const status: OrderRecord['status'] =
    row.status === 'accepted'
      ? 'Meetup set'
      : row.status === 'completed'
        ? 'Completed'
        : row.status === 'requested'
          ? 'Awaiting seller'
          : 'Cancelled'
  const tab: OrderRecord['tab'] =
    row.status === 'completed'
      ? 'Completed'
      : row.status === 'cancelled' || row.status === 'declined'
        ? 'Cancelled'
        : 'Active'
  return { status, tab }
}

/**
 * Server order -> the record My Orders renders.
 *
 * The buyer's snapshot used to receive this object only from the checkout that
 * created it in the same browser; a request placed on another device, or an
 * order the server knew about first, left the Completed tab empty even though
 * the request line above it showed the same order. Merging this shape fixes
 * that, and it is what makes the rating panel reachable.
 */
export function orderRecordFromApi(row: ApiOrder): OrderRecord {
  const lines: OrderLine[] = row.lines.map((line) => ({
    pid: API_ID_PREFIX + line.listing_slug,
    qty: line.quantity,
    price: Number(line.unit_price),
    name: line.title,
    kind: 'product',
    apiListingId: line.listing,
  }))
  const method = row.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'
  const place = row.meetup_place || 'Campus meetup'
  const when = `${method} · ${place}${row.meetup_time ? `, ${row.meetup_time}` : ''}`
  const first = lines[0]?.name ?? 'Order'
  const title = lines.length > 1 ? `${first} + ${lines.length - 1} more` : first

  return {
    id: row.reference,
    title,
    total: Number(row.total_amount),
    ...orderStatusFromApi(row),
    seller: row.seller_name,
    when,
    stage: row.status === 'completed' ? 3 : row.status === 'accepted' ? 2 : 1,
    tone: 'yellow',
    icon: 'bag',
    buyerEmail: row.buyer_email,
    sellerEmail: row.seller_email,
    lines,
    fulfillment: row.fulfillment === 'both' ? 'pickup' : row.fulfillment,
  }
}
