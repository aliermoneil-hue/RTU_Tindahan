/**
 * APPEALS API
 * ---------------------------------------------------------------
 * AI-06 and RM-08: one shape for "I disagree with a decision". A member files
 * one, staff read the queue, and the reviewer cannot be the person who decided.
 * The rules live on the server; this file only speaks to them.
 */
import { apiFetch } from '@/common/api/client'

export type AppealKind = 'listing' | 'post' | 'comment' | 'account'
export type AppealStatus = 'pending' | 'granted' | 'denied'

export interface ApiAppeal {
  id: number
  kind: AppealKind
  status: AppealStatus
  reason: string
  target_label: string
  appellant_name: string
  is_mine: boolean
  original_decider_name: string
  decided_by_name: string
  decided_at: string | null
  decision_note: string
  created_at: string
}

interface ApiPage<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

async function collect<T>(path: string): Promise<T[]> {
  const out: T[] = []
  let next: string | null = path
  for (let page = 0; page < 5 && next; page += 1) {
    const data: ApiPage<T> = await apiFetch<ApiPage<T>>(next)
    out.push(...(data.results ?? []))
    next = data.next
      ? data.next.slice(data.next.indexOf('/api/v1') + '/api/v1'.length)
      : null
  }
  return out
}

export function fetchAppeals(status?: AppealStatus): Promise<ApiAppeal[]> {
  return collect<ApiAppeal>(`/appeals/${status ? `?status=${status}` : ''}`)
}

export function createAppeal(input: {
  kind: AppealKind
  reason: string
  listing?: number
  post?: number
  comment?: number
}): Promise<ApiAppeal> {
  return apiFetch<ApiAppeal>('/appeals/', { method: 'POST', body: input })
}

export function decideAppeal(
  id: number,
  grant: boolean,
  note: string,
): Promise<ApiAppeal> {
  return apiFetch<ApiAppeal>(`/appeals/${id}/decide/`, {
    method: 'POST',
    body: { grant, note },
  })
}

/**
 * RM-08 from the outside: a suspended account cannot sign in to appeal, so the
 * appeal is filed with the credentials it already has.
 */
export function appealSuspension(input: {
  email: string
  password: string
  reason: string
}): Promise<{ id: number; status: AppealStatus; detail: string }> {
  return apiFetch('/appeals/suspension/', { method: 'POST', body: input })
}
