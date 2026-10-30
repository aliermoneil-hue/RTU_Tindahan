import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiRequestError, apiFetch, getToken, setToken } from '@/common/api/client'
import type { User } from '@/common/types'

/**
 * AUTH CONTEXT
 * ---------------------------------------------------------------
 * Keeps "who is signed in" for the whole app. Any component can call
 *   const { user, login, logout } = useAuth()
 * It talks to the EXISTING backend endpoints only:
 *   POST /auth/login/   -> { token, user }
 *   GET  /auth/me/      -> user          (used to restore a session)
 *   POST /auth/logout/  -> 204
 */

interface AuthValue {
  user: User | null
  /** true while we check a saved token when the page first loads */
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(() => getToken() !== null)

  // On first load: if a token is saved, ask the backend who it belongs to.
  useEffect(() => {
    if (!getToken()) return
    let cancelled = false
    apiFetch<User>('/auth/me/')
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch((err: unknown) => {
        // 401 = token no longer valid -> forget it. Other errors keep the token.
        if (err instanceof ApiRequestError && err.status === 401) setToken(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User }>('/auth/login/', {
      method: 'POST',
      body: { email, password },
    })
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>('/auth/logout/', { method: 'POST' })
    } catch {
      /* even if the server is unreachable we still sign out locally */
    }
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, isLoading, login, logout }), [user, isLoading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
