/**
 * Password reset calls (AV-06).
 *
 * The backend answers the same way whether or not the address has an account,
 * so the screens must not promise more than that: they say "if that address has
 * an account" and never "we sent you a code".
 */

import { apiFetch } from '@/common/api/client'

export interface ResetRequestResult {
  detail: string
  code_expires_in_minutes: number
}

export interface ResetConfirmInput {
  email: string
  code: string
  password: string
  password_confirm: string
}

export function requestPasswordReset(email: string): Promise<ResetRequestResult> {
  return apiFetch<ResetRequestResult>('/auth/password-reset/', {
    method: 'POST',
    body: { email: email.trim().toLowerCase() },
  })
}

export function confirmPasswordReset(input: ResetConfirmInput): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>('/auth/password-reset/confirm/', {
    method: 'POST',
    body: {
      email: input.email.trim().toLowerCase(),
      code: input.code.trim(),
      password: input.password,
      password_confirm: input.password_confirm,
    },
  })
}
