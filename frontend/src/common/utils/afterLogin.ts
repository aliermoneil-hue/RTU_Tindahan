/** After-login redirect helper. Stores the target page in sessionStorage so the
 * sign-in flow can take the user back to the tile/page they tried to open. */

export type AfterLoginTarget =
  | 'marketplace'
  | 'browse'
  | 'cart'
  | 'create'
  | 'orders'
  | 'store'
  | 'shop'
  | 'profile'
  | 'product'
  | 'student-sellers'
  | 'books'
  | 'merch'

const KEY = 'rtu:after-login'
const MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

const WHITELIST: ReadonlySet<string> = new Set([
  'marketplace',
  'browse',
  'cart',
  'create',
  'orders',
  'store',
  'shop',
  'profile',
  'product',
  'student-sellers',
  'books',
  'merch',
])

function pathOf(target: string): string {
  return target.split('?')[0]
}

/** Save the page to return to after signing in. */
export function setAfterLogin(target: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ to: target, at: Date.now() }))
  } catch {
    /* sessionStorage unavailable or quota-exceeded; ignore */
  }
}

/** Return the saved target if it is fresh and on the whitelist. */
export function peekAfterLogin(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { to?: string; at?: number }
    if (!parsed.to || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > MAX_AGE_MS) return null
    if (!WHITELIST.has(pathOf(parsed.to))) return null
    return parsed.to
  } catch {
    return null
  }
}

/** Remove the saved target. */
export function clearAfterLogin(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
