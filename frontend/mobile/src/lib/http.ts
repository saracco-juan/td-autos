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

// The request never got a response: server down, wrong API_URL or no connection.
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network request failed', { cause })
    this.name = 'NetworkError'
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  // Sanctum API token: sent as a bearer credential.
  token?: string | null
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

export async function apiFetch<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (failure) {
    throw new NetworkError(failure)
  }

  const data = await parseBody(response)
  if (!response.ok) throw new HttpError(response.status, data)
  return data as T
}
