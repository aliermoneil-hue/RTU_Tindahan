import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch, getToken, setToken } from '@/common/api/client'
import type { User } from '@/common/types'

/**
 * AUTH CONTEXT — the Django backend is the source of truth
 * ------------------------------------------------------------
 * Replaced the prototype's offline authentication. Now:
 *
 *   Sign up   1. details  -> POST /auth/register/  (creates a visitor account
 *                           and emails a 6-digit code)
 *             2. code     -> POST /auth/verify-code/ (activates the account and
 *                           returns a token, so the user is signed in)
 *   Sign in                -> POST /auth/login/  (token, or an error code such
 *                           as "email_not_verified")
 *   Reload                 -> GET /auth/me/ with the stored token
 *   Sign out               -> POST /auth/logout/ deletes the token server-side
 *
 * The token lives in localStorage under `rtu_token` (see common/api/client.ts)
 * and is sent as `Authorization: Token <key>`.
 */

const STUDENT_EMAIL = /^\d{4}-\d{6}@rtu\.edu\.ph$/i
const LOGIN_EMAIL = /^[^@\s]+@rtu\.edu\.ph$/i

/** What the sign-up screen collects before the code is sent. */
export interface RegisterInput {
  first: string
  last: string
  email: string
  pass: string
  prog: string
  year: number | null
  consent: boolean
}

interface OtpState {
  /** Where the code was sent. Drives the "we emailed you" screen. */
  to: string
  /** When it was requested, so the screen can show a resend countdown. */
  sentAt: number
}

interface AuthValue {
  user: User | null
  /** true while restoring the session on first load */
  isLoading: boolean
  /** true while the login() API call is in flight (drives the persistent BrandLoader) */
  isSigningIn: boolean
  /** The pending sign-up code request (null before one has been sent) */
  otp: OtpState | null
  login: (email: string, password: string) => Promise<void>
  /** Step 2 of sign up: create the account and email a 6-digit code. */
  register: (input: RegisterInput) => Promise<void>
  /** Ask for another 6-digit code (30-second cooldown server-side). */
  resendCode: (email: string) => Promise<void>
  /** Step 3 of sign up: check the code and sign in. */
  confirmCode: (email: string, code: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false)
  const [otp, setOtp] = useState<OtpState | null>(null)

  // -----------------------------------------------------------------------
  // On first load: if a token is stored, ask the server who it belongs to.
  // A rejected token is dropped so the user simply appears signed out.
  // -----------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      if (!getToken()) {
        setIsLoading(false)
        return
      }
      try {
        const me = await apiFetch<User>('/auth/me/')
        if (!cancelled) setUser(me)
      } catch {
        setToken(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  // -----------------------------------------------------------------------
  // Sign in
  // -----------------------------------------------------------------------
  const login = useCallback(async (email: string, password: string) => {
    const address = email.trim().toLowerCase()
    if (!LOGIN_EMAIL.test(address)) {
      throw new Error('Use your RTU email, like 2024-123456@rtu.edu.ph.')
    }
    if (!password) throw new Error('Enter your password.')

    setIsSigningIn(true)
    try {
      const data = await apiFetch<{ token: string; user: User }>('/auth/login/', {
        method: 'POST',
        body: { email: address, password },
      })
      setToken(data.token)
      setUser(data.user)
    } finally {
      setIsSigningIn(false)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Sign up, step 1 -> 2: create the account, then email the code
  // -----------------------------------------------------------------------
  const register = useCallback(async (input: RegisterInput) => {
    const address = input.email.trim().toLowerCase()
    if (!STUDENT_EMAIL.test(address)) {
      throw new Error('Your RTU email must look like 2024-123456@rtu.edu.ph.')
    }
    if (!input.consent) {
      throw new Error('Accept the privacy notice to create your account.')
    }

    const displayName = `${input.first.trim()} ${input.last.trim()}`.trim()
    await apiFetch<{ detail: string; email: string }>('/auth/register/', {
      method: 'POST',
      body: {
        email: address,
        display_name: displayName,
        password: input.pass,
        password_confirm: input.pass,
        member_type: 'student',
        college: input.prog,
        ...(input.year ? { year_level: input.year } : {}),
        privacy_consent: input.consent,
      },
    })

    setOtp({ to: address, sentAt: Date.now() })
  }, [])

  const resendCode = useCallback(async (email: string) => {
    const address = email.trim().toLowerCase()
    await apiFetch<{ detail: string }>('/auth/resend-code/', {
      method: 'POST',
      body: { email: address },
    })
    setOtp({ to: address, sentAt: Date.now() })
  }, [])

  // -----------------------------------------------------------------------
  // Sign up, step 3: the code activates the account and signs the user in
  // -----------------------------------------------------------------------
  const confirmCode = useCallback(async (email: string, code: string) => {
    const address = email.trim().toLowerCase()
    const digits = String(code).replace(/\s/g, '')
    if (!/^\d{6}$/.test(digits)) {
      throw new Error('Enter the 6 digits from the email.')
    }

    const data = await apiFetch<{ token: string; user: User }>(
      '/auth/verify-code/',
      { method: 'POST', body: { email: address, code: digits } },
    )
    setToken(data.token)
    setUser(data.user)
    setOtp(null)
  }, [])

  // -----------------------------------------------------------------------
  // Sign out
  // -----------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout/', { method: 'POST' })
    } catch {
      /* the token may already be gone; local state still has to clear */
    }
    setToken(null)
    setUser(null)
    setOtp(null)
  }, [])

  const value = useMemo(
    () => ({ user, isLoading, isSigningIn, otp, login, register, resendCode, confirmCode, logout }),
    [user, isLoading, isSigningIn, otp, login, register, resendCode, confirmCode, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
