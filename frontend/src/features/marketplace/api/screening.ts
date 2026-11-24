/**
 * AI-10: the screening terms an administrator owns. The server keeps the
 * shipped list as the floor, so an empty table still screens.
 */
import { apiFetch } from '@/common/api/client'

export interface ApiScreeningRule {
  id: number
  phrase: string
  kind: 'prohibited' | 'scam'
  kind_display: string
  note: string
  is_active: boolean
  added_by: string
  created_at: string
  updated_at: string
}

export async function fetchScreeningRules(): Promise<ApiScreeningRule[]> {
  const data = await apiFetch<ApiScreeningRule[] | { results: ApiScreeningRule[] }>(
    '/screening-rules/',
  )
  return Array.isArray(data) ? data : data.results
}

export function createScreeningRule(input: {
  phrase: string
  kind: 'prohibited' | 'scam'
  note?: string
}): Promise<ApiScreeningRule> {
  return apiFetch<ApiScreeningRule>('/screening-rules/', { method: 'POST', body: input })
}

export function updateScreeningRule(
  id: number,
  patch: { phrase?: string; kind?: 'prohibited' | 'scam'; note?: string; is_active?: boolean },
): Promise<ApiScreeningRule> {
  return apiFetch<ApiScreeningRule>(`/screening-rules/${id}/`, {
    method: 'PATCH',
    body: patch,
  })
}

export function deleteScreeningRule(id: number): Promise<void> {
  return apiFetch<void>(`/screening-rules/${id}/`, { method: 'DELETE' })
}
