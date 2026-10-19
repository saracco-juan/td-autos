import { API_URL } from '../../lib/config'
import { apiFetch, HttpError, NetworkError } from '../../lib/http'

function respond(status: number, body?: unknown) {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  return Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(text) })
}

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

describe('apiFetch', () => {
  it('sends JSON requests to the API with the Accept header', async () => {
    fetchMock.mockReturnValue(respond(200, { ok: true }))

    const data = await apiFetch<{ ok: boolean }>('/api/x', { method: 'POST', body: { a: 1 } })

    expect(data).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_URL}/api/x`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"a":1}')
    expect(init.headers).toMatchObject({ Accept: 'application/json', 'Content-Type': 'application/json' })
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('adds the bearer token when one is given', async () => {
    fetchMock.mockReturnValue(respond(200, {}))

    await apiFetch('/api/user', { token: 'abc' })

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc')
    expect(fetchMock.mock.calls[0][1].method).toBe('GET')
  })

  it('resolves to undefined on an empty body (204)', async () => {
    fetchMock.mockReturnValue(respond(204))

    await expect(apiFetch('/api/mobile/logout', { method: 'POST', token: 't' })).resolves.toBeUndefined()
  })

  it('throws an HttpError carrying the status and the parsed body', async () => {
    fetchMock.mockReturnValue(respond(422, { errors: { email: ['Mal'] } }))

    const failure = await apiFetch('/x').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(HttpError)
    expect((failure as HttpError).status).toBe(422)
    expect((failure as HttpError).body).toEqual({ errors: { email: ['Mal'] } })
  })

  it('keeps a non-JSON error body as text', async () => {
    fetchMock.mockReturnValue(respond(500, 'boom'))

    const failure = (await apiFetch('/x').catch((error: unknown) => error)) as HttpError

    expect(failure.body).toBe('boom')
  })

  it('throws a NetworkError when the request never gets a response', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))

    await expect(apiFetch('/x')).rejects.toBeInstanceOf(NetworkError)
  })
})
