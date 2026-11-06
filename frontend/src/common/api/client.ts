/**
 * API CLIENT
 * ---------------------------------------------------------------
 * One small wrapper around fetch() for talking to the Django backend.
 * - Base address comes from VITE_API_BASE_URL (see frontend/.env.example).
 * - The login token is stored in the browser and sent as
 *   "Authorization: Token <key>" (what Django REST Framework expects).
 * Nothing here changes the backend; it only calls the endpoints that exist.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'rtu_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore storage problems */
  }
}

/** Thrown for any failed request. `message` is safe to show to the user. */
export class ApiRequestError extends Error {
  status: number
  /** Machine code from the backend, e.g. "email_not_verified". */
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

/** Turns Django's error JSON ({detail} or {field: [msgs]}) into one sentence. */
function messageFrom(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (typeof obj.detail === 'string') return obj.detail
    if (Array.isArray(obj.detail) && typeof obj.detail[0] === 'string') return obj.detail[0]
    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
      if (typeof value === 'string') return value
    }
  }
  return fallback
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Token ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiRequestError('Cannot reach the server. Check your connection and try again.', 0)
  }

  if (response.status === 204) return undefined as T

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    /* empty or non-JSON body */
  }

  if (!response.ok) {
    const code =
      data && typeof data === 'object' && typeof (data as { code?: unknown }).code === 'string'
        ? ((data as { code: string }).code)
        : undefined
    throw new ApiRequestError(messageFrom(data, 'Something went wrong. Please try again.'), response.status, code)
  }
  return data as T
}
