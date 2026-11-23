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

/** First human-readable string anywhere in Django's error JSON. */
function firstMessage(value: unknown, depth = 0): string | null {
  if (depth > 3) return null
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstMessage(item, depth + 1)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = firstMessage(item, depth + 1)
      if (found) return found
    }
  }
  return null
}

/** Turns Django's error JSON ({detail}, {field: [msgs]} or nested upload errors) into one sentence. */
function messageFrom(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (typeof obj.detail === 'string') return obj.detail
    if (Array.isArray(obj.detail) && typeof obj.detail[0] === 'string') return obj.detail[0]
  }
  // Photo errors arrive nested, e.g. {"upload_photos": {"0": ["..."]}}, so a
  // one-level walk would miss them and show a generic message.
  return firstMessage(data, 1) ?? fallback
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

async function parse<T>(response: Response): Promise<T> {
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

  return parse<T>(response)
}

/** GET a binary response, such as a database backup. Errors share the JSON path. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Token ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { headers })
  } catch {
    throw new ApiRequestError('Cannot reach the server. Check your connection and try again.', 0)
  }

  if (!response.ok) {
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      /* not JSON */
    }
    throw new ApiRequestError(
      messageFrom(data, 'That download could not be prepared.'),
      response.status,
    )
  }

  const disposition = response.headers.get('Content-Disposition') ?? ''
  const named = /filename="([^"]+)"/.exec(disposition)
  return {
    blob: await response.blob(),
    filename: named?.[1] ?? 'rtu-tindahan-backup.sqlite3',
  }
}

/**
 * POST multipart/form-data — used for anything carrying a file, such as a
 * listing with photos. The browser sets the Content-Type (with its boundary),
 * so this must not set it by hand.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Token ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: form,
    })
  } catch {
    throw new ApiRequestError('Cannot reach the server. Check your connection and try again.', 0)
  }

  return parse<T>(response)
}
