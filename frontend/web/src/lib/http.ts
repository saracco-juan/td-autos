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

// The request never got a response: server down, wrong API_URL, CORS failure or no internet.
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network request failed', { cause })
    this.name = 'NetworkError'
  }
}

async function request(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (failure) {
    throw new NetworkError(failure)
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
}

function readXsrfToken(): string | undefined {
  const entry = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='))
  return entry ? decodeURIComponent(entry.slice('XSRF-TOKEN='.length)) : undefined
}

export async function ensureCsrfCookie(): Promise<void> {
  await request(`${API_URL}/sanctum/csrf-cookie`, {
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

// The CSRF cookie is requested only when there is none (or when a 419 says the one we have is stale):
// asking for it before every write would double the round trips of each one.
async function send(path: string, { method = 'GET', body }: RequestOptions, refreshCsrf = false) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (method !== 'GET') {
    if (refreshCsrf || readXsrfToken() === undefined) await ensureCsrfCookie()
    const token = readXsrfToken()
    if (token) headers['X-XSRF-TOKEN'] = token
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  return request(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)
  // The CSRF token may have expired: refresh it and retry a single time.
  if (response.status === 419) response = await send(path, options, true)

  const data = await parseBody(response)
  if (!response.ok) throw new HttpError(response.status, data)
  return data as T
}
