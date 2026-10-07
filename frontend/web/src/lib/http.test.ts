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
  it('fetches the csrf cookie before a POST and sends the decoded token', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(201, { id: 1 }))

    const result = await apiFetch('/register', { method: 'POST', body: { name: 'Ana' } })

    expect(result).toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [csrfUrl, csrfInit] = fetchMock.mock.calls[0]
    expect(csrfUrl).toBe(`${API_URL}/sanctum/csrf-cookie`)
    expect(csrfInit.credentials).toBe('include')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe(`${API_URL}/register`)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers['X-XSRF-TOKEN']).toBe('token==')
    expect(init.headers.Accept).toBe('application/json')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ name: 'Ana' }))
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
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(422, body))

    const error = await apiFetch<never>('/register', { method: 'POST', body: {} }).catch((e: unknown) => e as HttpError<{ errors?: unknown }>)

    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(422)
    expect(error.body).toEqual(body)
  })

  it('refreshes the csrf cookie and retries once on 419', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(419, { message: 'CSRF token mismatch.' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(201, { id: 2 }))

    const result = await apiFetch('/register', { method: 'POST', body: {} })

    expect(result).toEqual({ id: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('does not retry more than once after a second 419', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(419))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(419))

    const error = await apiFetch<never>('/register', { method: 'POST', body: {} }).catch((e: unknown) => e as HttpError<{ errors?: unknown }>)

    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(419)
    expect(fetchMock).toHaveBeenCalledTimes(4)
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
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(apiFetch('/register', { method: 'POST', body: {} })).rejects.toBeInstanceOf(NetworkError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
