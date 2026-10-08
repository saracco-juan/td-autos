import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from './config'
import { apiFetch, HttpError, NetworkError } from './http'

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setXsrfCookie(value: string) {
  document.cookie = `XSRF-TOKEN=${value}; path=/`
}

function clearXsrfCookie() {
  document.cookie = 'XSRF-TOKEN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

// The csrf endpoint answers 204 and sets the cookie, like Sanctum does.
function csrfResponse(token = 'fresh') {
  setXsrfCookie(token)
  return new Response(null, { status: 204 })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setXsrfCookie('token%3D%3D')
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('apiFetch', () => {
  it('sends the decoded token of a POST without asking for the csrf cookie when it is already there', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 1 }))

    const result = await apiFetch('/register', { method: 'POST', body: { name: 'Ana' } })

    expect(result).toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_URL}/register`)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers['X-XSRF-TOKEN']).toBe('token==')
    expect(init.headers.Accept).toBe('application/json')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ name: 'Ana' }))
  })

  it('sends the decoded token of a PUT without asking for the csrf cookie when it is already there', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 1 }))

    const result = await apiFetch('/api/user', { method: 'PUT', body: { name: 'Ana' } })

    expect(result).toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_URL}/api/user`)
    expect(init.method).toBe('PUT')
    expect(init.headers['X-XSRF-TOKEN']).toBe('token==')
  })

  it('fetches the csrf cookie first when there is none, then sends the token it set', async () => {
    clearXsrfCookie()
    fetchMock.mockImplementationOnce(async () => csrfResponse('fresh%3D')).mockResolvedValueOnce(jsonResponse(201, { id: 1 }))

    const result = await apiFetch('/register', { method: 'POST', body: { name: 'Ana' } })

    expect(result).toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [csrfUrl, csrfInit] = fetchMock.mock.calls[0]
    expect(csrfUrl).toBe(`${API_URL}/sanctum/csrf-cookie`)
    expect(csrfInit.credentials).toBe('include')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe(`${API_URL}/register`)
    expect(init.headers['X-XSRF-TOKEN']).toBe('fresh=')
  })

  it('asks for the csrf cookie only once across several writes', async () => {
    clearXsrfCookie()
    fetchMock
      .mockImplementationOnce(async () => csrfResponse())
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}))

    await apiFetch('/api/a', { method: 'PUT', body: {} })
    await apiFetch('/api/b', { method: 'PUT', body: {} })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.filter(([url]) => url === `${API_URL}/sanctum/csrf-cookie`)).toHaveLength(1)
  })

  it('refreshes the csrf cookie even if one is present, then retries a PUT once on 419 with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(419))
      .mockImplementationOnce(async () => csrfResponse('new'))
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }))

    await expect(apiFetch('/api/user', { method: 'PUT', body: {} })).resolves.toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][1].headers['X-XSRF-TOKEN']).toBe('token==')
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_URL}/sanctum/csrf-cookie`)
    expect(fetchMock.mock.calls[2][1].method).toBe('PUT')
    expect(fetchMock.mock.calls[2][1].headers['X-XSRF-TOKEN']).toBe('new')
  })

  it('does not fetch the csrf cookie for a GET', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 1 }))

    await apiFetch('/api/user')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/api/user`)
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
    expect(fetchMock.mock.calls[0][1].headers.Accept).toBe('application/json')
  })

  it('throws an HttpError carrying status and body on 422', async () => {
    const body = { message: 'invalid', errors: { email: ['taken'] } }
    fetchMock.mockResolvedValueOnce(jsonResponse(422, body))

    const error = await apiFetch<never>('/register', { method: 'POST', body: {} }).catch((e: unknown) => e as HttpError<{ errors?: unknown }>)

    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(422)
    expect(error.body).toEqual(body)
  })

  it('does not retry more than once after a second 419', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(419))
      .mockImplementationOnce(async () => csrfResponse())
      .mockResolvedValueOnce(jsonResponse(419))

    const error = await apiFetch<never>('/register', { method: 'POST', body: {} }).catch((e: unknown) => e as HttpError<{ errors?: unknown }>)

    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(419)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns undefined for an empty successful response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(apiFetch('/api/ping')).resolves.toBeUndefined()
  })

  it('throws a NetworkError when the server cannot be reached', async () => {
    const cause = new TypeError('Failed to fetch')
    fetchMock.mockRejectedValueOnce(cause)

    const error = await apiFetch('/api/user').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NetworkError)
    expect((error as NetworkError).cause).toBe(cause)
  })

  it('throws a NetworkError when the csrf cookie request cannot reach the server', async () => {
    clearXsrfCookie()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(apiFetch('/register', { method: 'POST', body: {} })).rejects.toBeInstanceOf(NetworkError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
