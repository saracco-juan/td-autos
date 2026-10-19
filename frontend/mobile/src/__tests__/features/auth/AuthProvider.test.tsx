import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'

import * as api from '../../../features/auth/api'
import AuthProvider from '../../../features/auth/AuthProvider'
import { useAuth } from '../../../features/auth/useAuth'
import * as http from '../../../lib/http'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'

jest.mock('../../../features/auth/api')
jest.mock('../../../lib/tokenStorage')

const apiMock = jest.mocked(api)
const storage = jest.mocked(tokenStorage)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }

function Probe() {
  const { status, user, login, register, completeGoogle, logout } = useAuth()
  const run = (action: () => Promise<void>) => () =>
    action().catch((error: Error) => console.log(`failed:${error.message}`))
  return (
    <>
      <Text>status:{status}</Text>
      <Text>user:{user?.email ?? 'none'}</Text>
      <Pressable onPress={run(() => login({ email: 'ana@example.com', password: 'x' }))}>
        <Text>login</Text>
      </Pressable>
      <Pressable
        onPress={run(() =>
          register({ name: 'Ana', email: 'ana@example.com', password: 'P1', passwordConfirmation: 'P1' }),
        )}
      >
        <Text>register</Text>
      </Pressable>
      <Pressable onPress={run(() => completeGoogle('code'))}>
        <Text>google</Text>
      </Pressable>
      <Pressable onPress={run(logout)}>
        <Text>logout</Text>
      </Pressable>
    </>
  )
}

// Exercises the helpers that feature screens use: an authenticated call and a user reload.
function FeatureProbe() {
  const { user, authFetch, refreshUser } = useAuth()
  return (
    <>
      <Text>diagnosis:{String(user?.tiene_diagnostico ?? 'none')}</Text>
      <Pressable
        onPress={() =>
          void authFetch<{ ok: boolean }>('/api/x', { method: 'PUT', body: { a: 1 } }).then((data) =>
            console.log(`fetched:${String(data.ok)}`),
          )
        }
      >
        <Text>fetch</Text>
      </Pressable>
      <Pressable onPress={() => void refreshUser().then(() => console.log('refreshed'))}>
        <Text>refresh</Text>
      </Pressable>
    </>
  )
}

async function mount(probe = <Probe />) {
  await render(<AuthProvider>{probe}</AuthProvider>)
}

describe('AuthProvider', () => {
  let logSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue(null)
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => logSpy.mockRestore())

  it('starts as guest without calling the API when there is no stored token', async () => {
    await mount()

    expect(await screen.findByText('status:guest')).toBeOnTheScreen()
    expect(apiMock.fetchCurrentUser).not.toHaveBeenCalled()
  })

  it('shows loading until the stored token is checked, then authenticates', async () => {
    storage.readToken.mockResolvedValue('tok')
    let resolveUser: (user: typeof USER) => void = () => undefined
    apiMock.fetchCurrentUser.mockReturnValue(new Promise((resolve) => (resolveUser = resolve)))

    await mount()

    expect(screen.getByText('status:loading')).toBeOnTheScreen()
    await act(async () => resolveUser(USER))
    expect(await screen.findByText('status:authenticated')).toBeOnTheScreen()
    expect(screen.getByText('user:ana@example.com')).toBeOnTheScreen()
    expect(apiMock.fetchCurrentUser).toHaveBeenCalledWith('tok')
  })

  it('clears the token and becomes guest when the stored token is rejected (401)', async () => {
    storage.readToken.mockResolvedValue('stale')
    apiMock.fetchCurrentUser.mockRejectedValue(new HttpError(401, { message: 'Unauthenticated.' }))

    await mount()

    expect(await screen.findByText('status:guest')).toBeOnTheScreen()
    expect(storage.clearToken).toHaveBeenCalled()
  })

  it('becomes guest but keeps the token when the API cannot be reached', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockRejectedValue(new NetworkError(new Error('down')))

    await mount()

    expect(await screen.findByText('status:guest')).toBeOnTheScreen()
    expect(storage.clearToken).not.toHaveBeenCalled()
  })

  it('login stores the token and authenticates', async () => {
    apiMock.loginWithPassword.mockResolvedValue({ token: 'new', user: USER })
    await mount()
    await screen.findByText('status:guest')

    await fireEvent.press(screen.getByText('login'))

    expect(await screen.findByText('status:authenticated')).toBeOnTheScreen()
    expect(storage.saveToken).toHaveBeenCalledWith('new')
  })

  it('login failure leaves the session as guest and rethrows', async () => {
    apiMock.loginWithPassword.mockRejectedValue(new HttpError(422, {}))
    await mount()
    await screen.findByText('status:guest')

    await fireEvent.press(screen.getByText('login'))

    await waitFor(() => expect(logSpy).toHaveBeenCalledWith('failed:HTTP 422'))
    expect(screen.getByText('status:guest')).toBeOnTheScreen()
    expect(storage.saveToken).not.toHaveBeenCalled()
  })

  it('register and google exchange also authenticate', async () => {
    apiMock.registerWithPassword.mockResolvedValue({ token: 'r', user: USER })
    apiMock.exchangeGoogleCode.mockResolvedValue({ token: 'g', user: USER })
    await mount()
    await screen.findByText('status:guest')

    await fireEvent.press(screen.getByText('register'))
    await screen.findByText('status:authenticated')
    expect(storage.saveToken).toHaveBeenLastCalledWith('r')

    await fireEvent.press(screen.getByText('google'))
    await waitFor(() => expect(storage.saveToken).toHaveBeenLastCalledWith('g'))
    expect(apiMock.exchangeGoogleCode).toHaveBeenCalledWith('code')
  })

  describe('logout', () => {
    async function authenticated() {
      storage.readToken.mockResolvedValue('tok')
      apiMock.fetchCurrentUser.mockResolvedValue(USER)
      await mount()
      await screen.findByText('status:authenticated')
    }

    it('revokes the token on the server, clears it and becomes guest', async () => {
      apiMock.logoutRequest.mockResolvedValue(undefined)
      await authenticated()

      await fireEvent.press(screen.getByText('logout'))

      expect(await screen.findByText('status:guest')).toBeOnTheScreen()
      expect(apiMock.logoutRequest).toHaveBeenCalledWith('tok')
      expect(storage.clearToken).toHaveBeenCalled()
    })

    it('clears the session even when the server answers 401', async () => {
      apiMock.logoutRequest.mockRejectedValue(new HttpError(401, {}))
      await authenticated()

      await fireEvent.press(screen.getByText('logout'))

      expect(await screen.findByText('status:guest')).toBeOnTheScreen()
      expect(storage.clearToken).toHaveBeenCalled()
    })

    it('keeps the session and surfaces the error on any other failure', async () => {
      apiMock.logoutRequest.mockRejectedValue(new HttpError(500, {}))
      await authenticated()

      await act(async () => {
        await fireEvent.press(screen.getByText('logout'))
      })

      await waitFor(() => expect(logSpy).toHaveBeenCalledWith('failed:HTTP 500'))
      expect(screen.getByText('status:authenticated')).toBeOnTheScreen()
      expect(storage.clearToken).not.toHaveBeenCalled()
    })
  })

  describe('feature helpers', () => {
    async function authenticated() {
      storage.readToken.mockResolvedValue('tok')
      apiMock.fetchCurrentUser.mockResolvedValue({ ...USER, tiene_diagnostico: false })
      await mount(<FeatureProbe />)
      await screen.findByText('diagnosis:false')
    }

    it('authFetch sends the request with the session token', async () => {
      const apiFetch = jest.spyOn(http, 'apiFetch').mockResolvedValue({ ok: true })
      await authenticated()

      await fireEvent.press(screen.getByText('fetch'))

      await waitFor(() => expect(logSpy).toHaveBeenCalledWith('fetched:true'))
      expect(apiFetch).toHaveBeenCalledWith('/api/x', { method: 'PUT', body: { a: 1 }, token: 'tok' })
      apiFetch.mockRestore()
    })

    it('refreshUser reloads the current user into the session', async () => {
      await authenticated()
      apiMock.fetchCurrentUser.mockResolvedValue({ ...USER, tiene_diagnostico: true })

      await fireEvent.press(screen.getByText('refresh'))

      expect(await screen.findByText('diagnosis:true')).toBeOnTheScreen()
      expect(apiMock.fetchCurrentUser).toHaveBeenLastCalledWith('tok')
    })

    it('refreshUser keeps the current user and resolves when the reload fails', async () => {
      await authenticated()
      apiMock.fetchCurrentUser.mockRejectedValue(new NetworkError(new Error('down')))

      await fireEvent.press(screen.getByText('refresh'))

      await waitFor(() => expect(logSpy).toHaveBeenCalledWith('refreshed'))
      expect(screen.getByText('diagnosis:false')).toBeOnTheScreen()
    })
  })
})
