import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sendMail } from '@/common/config'
import { setToken } from '@/common/api/client'
import type { User } from '@/common/types'

/**
 * AUTH CONTEXT — prototype-exact offline authentication
 * ------------------------------------------------------------
 * Mirrors the prototype's js/6-accounts-login.js exactly:
 *
 *   - hash()        : djb2 scramble for passwords and OTP codes
 *   - STUDENT_EMAIL : 4 digits, dash, 6 digits, @rtu.edu.ph
 *   - newCode()     : random 6-digit code
 *   - OTP_MS = 5 min, OTP_WAIT = 30 sec
 *   - Accounts stored locally in localStorage (rtu_auth_accounts)
 *   - No Django backend required for sign up or sign in
 *
 * The sign-up flow is 3 steps (prototype exact):
 *   1. Student account  — name, program, RTU email, password (8+ chars)
 *   2. Email code       — 6-digit code sent via EmailJS (demo mode shows it on screen)
 *   3. All set          — code checked, account created, user signed in
 *
 * Sign in:
 *   RTU email format check → account must exist → password hash must match
 *   → account must not be suspended or banned → load account → welcome toast
 */

// ---------------------------------------------------------------------------
// Prototype hash (djb2) — used for passwords and OTP codes
// ---------------------------------------------------------------------------
const hash = (s: string): string => {
  let h = 5381
  const t = 'rtu-tindahan:' + s
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0
  return String(h >>> 0)
}

// ---------------------------------------------------------------------------
// Student email pattern (prototype exact)
// ---------------------------------------------------------------------------
const STUDENT_EMAIL = /^\d{4}-\d{6}@rtu\.edu\.ph$/i

// ---------------------------------------------------------------------------
// OTP constants (prototype exact)
// ---------------------------------------------------------------------------
const OTP_MS = 300000   // a code lives 5 minutes
const OTP_WAIT = 30000  // 30 seconds before asking for another code

// ---------------------------------------------------------------------------
// Generate a random 6-digit code (with leading zeros)
// ---------------------------------------------------------------------------
function newCode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
}

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------
const ACCOUNTS_KEY = 'rtu_auth_accounts'
const SESSION_KEY = 'rtu_auth_session'

// ---------------------------------------------------------------------------
// Account store helpers (localStorage)
// ---------------------------------------------------------------------------
type RawAccount = {
  email: string
  ph: string           // hashed password
  first: string
  last: string
  name: string
  sid: string          // student number (text before @)
  role: 'student' | 'moderator'
  aff: string
  prog: string
  status: 'active' | 'suspended' | 'banned'
  verified: boolean
  since: string
  notifs: Array<{ t: string; read: boolean; ts: string; at?: string; link?: any | null }>
}

function loadAccounts(): RawAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    return raw ? (JSON.parse(raw) as RawAccount[]) : []
  } catch {
    return []
  }
}

function saveAccounts(accounts: RawAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {
    /* ignore storage problems */
  }
}

function findAccount(email: string): RawAccount | undefined {
  const e = String(email).trim().toLowerCase()
  return loadAccounts().find((a) => a.email === e)
}

// ---------------------------------------------------------------------------
// Convert a raw stored account into the shared User type
// ---------------------------------------------------------------------------
function toUser(a: RawAccount): User {
  return {
    id: a.email,
    email: a.email,
    display_name: a.name,
    role: a.role === 'moderator' ? 'moderator' : 'user',
    member_type: a.aff === 'Staff' ? 'personnel' : 'student',
    college: a.prog,
    year_level: null,
    contact_number: '',
    profile_photo: null,
    status: a.status,
    is_verified: a.verified,
    date_joined: a.since,
  }
}

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------
interface OtpState {
  to: string
  demo: boolean
  code: string | null       // kept only in demo mode
  h: string                 // hash('otp:' + code)
  exp: number               // expiry timestamp
  tries: number             // wrong attempts so far
  sentAt: number            // when the code was sent
}

interface AuthValue {
  user: User | null
  /** true while restoring the session on first load */
  isLoading: boolean
  /** The pending OTP (null when no code has been sent) */
  otp: OtpState | null
  /** Sign in with RTU email and password (local, offline). */
  login: (email: string, password: string) => Promise<void>
  /** Step 2 of sign up: create and send the 6-digit code. */
  sendCode: (email: string, firstName: string) => Promise<void>
  /** Step 3 of sign up: check the code, create the account, sign in. */
  verifyCode: (code: string, regData: { first: string; last: string; email: string; pass: string; prog: string }) => Promise<void>
  /** Sign out and clear the session. */
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [otp, setOtp] = useState<OtpState | null>(null)

  // -----------------------------------------------------------------------
  // On first load: restore the signed-in user from the saved session
  // -----------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) {
          setIsLoading(false)
          return
        }
        const session = JSON.parse(raw) as { email: string }
        const acct = findAccount(session.email)
        if (!cancelled && acct) {
          setUser(toUser(acct))
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // -----------------------------------------------------------------------
  // Sign in — prototype exact
  // -----------------------------------------------------------------------
  const LOGIN_EMAIL = /^[^@\s]+@rtu\.edu\.ph$/i

  const login = useCallback(async (email: string, password: string) => {
    const e = email.trim().toLowerCase()
    if (!LOGIN_EMAIL.test(e)) {
      throw new Error('Use your RTU email, like 2024-123456@rtu.edu.ph.')
    }
    const a = findAccount(e)
    if (!a) {
      throw new Error('No account found for that email. Create your account first.')
    }
    if (!password) {
      throw new Error('Enter your password.')
    }
    if (a.ph !== hash(password)) {
      throw new Error('That password is not right. Try again or use Forgot password.')
    }
    if (a.status === 'suspended' || a.status === 'banned') {
      throw new Error(
        a.status === 'banned'
          ? 'This account has been banned. Please contact the RTU Office of Student Affairs.'
          : 'This account is suspended for now. Please contact the RTU Office of Student Affairs.',
      )
    }

    // Save session and set user
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: e }))
    setToken(e) // keep a token so apiFetch auth headers work if the backend is added later
    setUser(toUser(a))
  }, [])

  // -----------------------------------------------------------------------
  // Step 2: send the 6-digit sign-up code — prototype exact
  // -----------------------------------------------------------------------
  const sendCode = useCallback(async (email: string, firstName: string) => {
    const g = email.trim().toLowerCase()
    if (!STUDENT_EMAIL.test(g)) {
      setOtp(null)
      throw new Error('Your RTU email must look like 2024-123456@rtu.edu.ph.')
    }
    if (findAccount(g)) {
      setOtp(null)
      throw new Error('An account with that email already exists. Sign in instead.')
    }
    if (otp && otp.to === g && Date.now() - otp.sentAt < OTP_WAIT) {
      const w = Math.ceil((OTP_WAIT - (Date.now() - otp.sentAt)) / 1000)
      setOtp(null)
      throw new Error(`Please wait ${w} seconds before asking for another code.`)
    }

    const code = newCode()
    const r = await sendMail(g, firstName || 'student', code)

    const nextOtp: OtpState = {
      to: g,
      demo: r.demo,
      code: r.demo ? code : null,
      h: hash('otp:' + code),
      exp: Date.now() + OTP_MS,
      tries: 0,
      sentAt: Date.now(),
    }
    setOtp(nextOtp)
  }, [otp])

  // -----------------------------------------------------------------------
  // Step 3: check the code, create the account, sign in — prototype exact
  // -----------------------------------------------------------------------
  const verifyCode = useCallback(
    async (code: string, regData: {
      first: string
      last: string
      email: string
      pass: string
      prog: string
    }) => {
      const v = regData
      const em = v.email.trim().toLowerCase()
      const c = String(code).replace(/\s/g, '')

      const o = otp
      if (!o) {
        throw new Error('Send a new code first.')
      }
      if (Date.now() > o.exp) {
        setOtp(null)
        throw new Error('That code expired. Send a new one.')
      }
      if (o.tries >= 5) {
        setOtp(null)
        throw new Error('Too many wrong tries. Send a new code.')
      }
      if (!/^\d{6}$/.test(c)) {
        throw new Error('Enter the 6 digits from the email.')
      }

      o.tries++
      if (hash('otp:' + c) !== o.h) {
        setOtp({ ...o })
        throw new Error(
          `That code is not right. ${5 - o.tries} ${
            5 - o.tries === 1 ? 'try' : 'tries'
          } left.`,
        )
      }

      if (findAccount(em)) {
        setOtp(null)
        throw new Error('An account with that email already exists. Sign in instead.')
      }

      // If no staff account exists yet, this first account becomes staff
      const existing = loadAccounts()
      const hasStaff = existing.some((a) => a.role === 'moderator')

      // Create the account (prototype mkAcct equivalent)
      const now = new Date()
      const newAcct: RawAccount = {
        email: em,
        ph: hash(v.pass),
        first: v.first.trim(),
        last: v.last.trim(),
        name: `${v.first.trim()} ${v.last.trim()}`,
        sid: em.split('@')[0],
        role: hasStaff ? 'student' : 'moderator',
        aff: hasStaff ? 'Student' : 'Staff',
        prog: hasStaff ? v.prog : 'Office of Student Affairs',
        status: 'active',
        verified: true,
        since: now.toISOString(),
        notifs: [
          {
            t: hasStaff
              ? 'Welcome to RTU Tindahan. Your RTU email is confirmed.'
              : 'Welcome — you are the first account, so you are set up as RTU staff.',
            read: false,
            ts: new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
            at: now.toISOString(),
            link: null,
          },
        ],
      }

      existing.push(newAcct)
      saveAccounts(existing)

      setOtp(null)
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email: em }))
      setToken(em)
      setUser(toUser(newAcct))
    },
    [otp],
  )

  // -----------------------------------------------------------------------
  // Sign out — clear session and user
  // -----------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    setToken(null)
    setUser(null)
    setOtp(null)
  }, [])

  const value = useMemo(
    () => ({ user, isLoading, otp, login, sendCode, verifyCode, logout }),
    [user, isLoading, otp, login, sendCode, verifyCode, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
