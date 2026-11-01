import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, getToken, setToken, setUnauthorizedHandler } from '../lib/api'
import { abilitiesFor } from '../lib/types'
import type { Abilities, SessionUser } from '../lib/types'

/** SE-04: the SRS signs users out after 30 minutes without activity. */
const IDLE_LIMIT_MS = 30 * 60 * 1000

interface AuthState {
  user: SessionUser | null
  ready: boolean
  abilities: Abilities
  notice: string
  login: (email: string, password: string) => Promise<void>
  logout: (notice?: string) => Promise<void>
  clearNotice: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const lastActive = useRef(Date.now())

  const endSession = useCallback((message: string) => {
    setToken(null)
    setUser(null)
    setNotice(message)
  }, [])

  // Restore the session after a page reload.
  useEffect(() => {
    const controller = new AbortController()
    if (!getToken()) {
      setReady(true)
      return
    }
    api
      .me(controller.signal)
      .then((me) => setUser(me))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // A dead token is cleared by the 401 handler; a network error keeps it.
        if (error instanceof ApiError && error.status === 0) setNotice(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true)
      })
    return () => controller.abort()
  }, [])

  // A 401 from any request means the token is gone.
  useEffect(() => {
    setUnauthorizedHandler(() => endSession('Your session has ended. Sign in again.'))
    return () => setUnauthorizedHandler(null)
  }, [endSession])

  const logout = useCallback(
    async (message = '') => {
      try {
        await api.logout()
      } catch {
        /* the token may already be invalid; sign out locally either way */
      }
      endSession(message)
    },
    [endSession],
  )

  // Idle timeout.
  useEffect(() => {
    if (!user) return
    lastActive.current = Date.now()
    const touch = () => {
      lastActive.current = Date.now()
    }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }))
    const timer = window.setInterval(() => {
      if (Date.now() - lastActive.current > IDLE_LIMIT_MS) {
        void logout('You were signed out after 30 minutes of inactivity.')
      }
    }, 15_000)
    return () => {
      events.forEach((name) => window.removeEventListener(name, touch))
      window.clearInterval(timer)
    }
  }, [user, logout])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email.trim(), password)
    setToken(result.token)
    setNotice('')
    setUser(result.user)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      abilities: abilitiesFor(user?.role),
      notice,
      login,
      logout,
      clearNotice: () => setNotice(''),
    }),
    [user, ready, notice, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
