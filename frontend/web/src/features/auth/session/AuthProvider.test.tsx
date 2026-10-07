import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../../lib/http'
import { fetchCurrentUser, loginUser, logoutUser } from '../api'
import AuthProvider from './AuthProvider'
import { useAuth } from './useAuth'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
}))

const ana = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }
const credentials = { email: 'ana@example.com', password: 'Abcdef12' }

// Latest context value seen by the probe, so tests can call login/logout/refresh.
const captured = {} as { auth: ReturnType<typeof useAuth> }

function Probe() {
  const auth = useAuth()
  useEffect(() => {
    captured.auth = auth
  })
  return (
    <>
      <p data-testid="status">{auth.status}</p>
      <p data-testid="user">{auth.user?.email ?? 'none'}</p>
      <p data-testid="error">{auth.errorKind ?? 'none'}</p>
    </>
  )
}

function renderProvider() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

const status = () => screen.getByTestId('status').textContent

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
    vi.mocked(loginUser).mockReset()
    vi.mocked(logoutUser).mockReset()
    vi.mocked(fetchCurrentUser).mockResolvedValue(ana)
    vi.mocked(loginUser).mockResolvedValue(undefined)
    vi.mocked(logoutUser).mockResolvedValue(undefined)
  })

  it('starts loading and loads the current user once on mount', async () => {
    renderProvider()

    expect(status()).toBe('loading')
    expect(await screen.findByText('authenticated')).toBeInTheDocument()
    expect(screen.getByTestId('user')).toHaveTextContent('ana@example.com')
    expect(fetchCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('becomes guest when the session is not authenticated (401)', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(401, { message: 'Unauthenticated.' }))
    renderProvider()

    expect(await screen.findByText('guest')).toBeInTheDocument()
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('reports a network error instead of becoming a guest', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))
    renderProvider()

    expect(await screen.findByText('error')).toBeInTheDocument()
    expect(screen.getByTestId('error')).toHaveTextContent('network')
  })

  it('reports a server error instead of becoming a guest', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(500, undefined))
    renderProvider()

    expect(await screen.findByText('error')).toBeInTheDocument()
    expect(screen.getByTestId('error')).toHaveTextContent('server')
  })

  it('login signs in and loads the user', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValueOnce(new HttpError(401, undefined))
    renderProvider()
    await screen.findByText('guest')

    await act(() => captured.auth.login(credentials))

    expect(loginUser).toHaveBeenCalledWith(credentials)
    expect(status()).toBe('authenticated')
    expect(screen.getByTestId('user')).toHaveTextContent('ana@example.com')
  })

  it('login rejects with the original HttpError and stays guest on failure', async () => {
    const failure = new HttpError(422, { errors: { email: ['Usuario incorrecto, por favor intente nuevamente'] } })
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(401, undefined))
    vi.mocked(loginUser).mockRejectedValue(failure)
    renderProvider()
    await screen.findByText('guest')

    await expect(act(() => captured.auth.login(credentials))).rejects.toBe(failure)

    expect(status()).toBe('guest')
    expect(fetchCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('logout ends the session', async () => {
    renderProvider()
    await screen.findByText('authenticated')

    await act(() => captured.auth.logout())

    expect(logoutUser).toHaveBeenCalledTimes(1)
    expect(status()).toBe('guest')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('logout becomes guest when the session was already gone (401)', async () => {
    vi.mocked(logoutUser).mockRejectedValue(new HttpError(401, undefined))
    renderProvider()
    await screen.findByText('authenticated')

    await act(() => captured.auth.logout())

    expect(status()).toBe('guest')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('logout rejects with the original error and stays authenticated on a server failure', async () => {
    const failure = new HttpError(500, undefined)
    vi.mocked(logoutUser).mockRejectedValue(failure)
    renderProvider()
    await screen.findByText('authenticated')

    await expect(act(() => captured.auth.logout())).rejects.toBe(failure)

    expect(status()).toBe('authenticated')
    expect(screen.getByTestId('user')).toHaveTextContent('ana@example.com')
  })

  it('logout rejects and stays authenticated on a network failure', async () => {
    const failure = new TypeError('Failed to fetch')
    vi.mocked(logoutUser).mockRejectedValue(failure)
    renderProvider()
    await screen.findByText('authenticated')

    await expect(act(() => captured.auth.logout())).rejects.toBe(failure)

    expect(status()).toBe('authenticated')
  })

  it('refresh re-reads the current user', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValueOnce(new HttpError(401, undefined))
    renderProvider()
    await screen.findByText('guest')

    await act(() => captured.auth.refresh())

    expect(status()).toBe('authenticated')
    expect(fetchCurrentUser).toHaveBeenCalledTimes(2)
  })

  it('refresh turns an expired session into guest', async () => {
    renderProvider()
    await screen.findByText('authenticated')
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(401, undefined))

    await act(() => captured.auth.refresh())

    expect(status()).toBe('guest')
  })
})

describe('useAuth', () => {
  it('throws a clear error outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider')

    consoleError.mockRestore()
  })
})

