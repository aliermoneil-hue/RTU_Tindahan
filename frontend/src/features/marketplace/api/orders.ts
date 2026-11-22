/**
 * ORDERS API — student-to-student requests.
 *
 * The Official Store uses tickets (api/store.ts). Every other seller uses these
 * orders, which live on the server so the seller actually receives the request:
 * before this existed the request was written into the buyer's own browser and
 * never left it.
 */

import { apiFetch } from '@/common/api/client'

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
