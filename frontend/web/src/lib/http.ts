import { API_URL } from './config'

export class HttpError<B = unknown> extends Error {
  readonly status: number
  readonly body: B

  constructor(status: number, body: B) {
    super(`HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
}

function readXsrfToken(): string | undefined {
  const entry = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='))
  return entry ? decodeURIComponent(entry.slice('XSRF-TOKEN='.length)) : undefined
}

export async function ensureCsrfCookie(): Promise<void> {
  await fetch(`${API_URL}/sanctum/csrf-cookie`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function send(path: string, { method = 'GET', body }: RequestOptions) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (method !== 'GET') {
    await ensureCsrfCookie()
    const token = readXsrfToken()
    if (token) headers['X-XSRF-TOKEN'] = token
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  return fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)
  // The CSRF token may have expired: refresh it and retry a single time.
  if (response.status === 419) response = await send(path, options)

  const data = await parseBody(response)
  if (!response.ok) throw new HttpError(response.status, data)
  return data as T
}
