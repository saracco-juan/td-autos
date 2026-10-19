import {
  exchangeGoogleCode,
  fetchCurrentUser,
  loginWithPassword,
  logoutRequest,
  registerWithPassword,
  requestPasswordReset,
} from '../../../features/auth/api'
import { apiFetch } from '../../../lib/http'

jest.mock('../../../lib/http', () => ({ apiFetch: jest.fn() }))
jest.mock('../../../lib/deviceName', () => ({ DEVICE_NAME: 'Pixel 9' }))

const apiFetchMock = jest.mocked(apiFetch)

describe('auth api', () => {
  beforeEach(() => apiFetchMock.mockReset())

  it('logs in with the device name', async () => {
    apiFetchMock.mockResolvedValue({ token: 't', user: {} })

    await loginWithPassword({ email: 'a@b.co', password: 'x' })

    expect(apiFetchMock).toHaveBeenCalledWith('/api/mobile/login', {
      method: 'POST',
      body: { email: 'a@b.co', password: 'x', device_name: 'Pixel 9' },
    })
  })

  it('registers with the confirmation and the device name', async () => {
    apiFetchMock.mockResolvedValue({ token: 't', user: {} })

    await registerWithPassword({ name: 'Ana', email: 'a@b.co', password: 'P1', passwordConfirmation: 'P1' })

    expect(apiFetchMock).toHaveBeenCalledWith('/api/mobile/register', {
      method: 'POST',
      body: { name: 'Ana', email: 'a@b.co', password: 'P1', password_confirmation: 'P1', device_name: 'Pixel 9' },
    })
  })

  it('exchanges the one-time google code', async () => {
    apiFetchMock.mockResolvedValue({ token: 't', user: {} })

    await exchangeGoogleCode('code-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/api/mobile/google/exchange', {
      method: 'POST',
      body: { code: 'code-1', device_name: 'Pixel 9' },
    })
  })

  it('reads the current user and logs out with the bearer token', async () => {
    apiFetchMock.mockResolvedValue(undefined)

    await fetchCurrentUser('tok')
    await logoutRequest('tok')

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/user', { token: 'tok' })
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/mobile/logout', { method: 'POST', token: 'tok' })
  })

  it('requests a password reset and returns the status text', async () => {
    apiFetchMock.mockResolvedValue({ status: 'Enviado.' })

    await expect(requestPasswordReset('a@b.co')).resolves.toBe('Enviado.')
    expect(apiFetchMock).toHaveBeenCalledWith('/api/mobile/forgot-password', {
      method: 'POST',
      body: { email: 'a@b.co' },
    })
  })
})
