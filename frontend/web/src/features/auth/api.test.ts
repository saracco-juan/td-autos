import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { API_URL } from '../../lib/config'
import { apiFetch } from '../../lib/http'
import {
  GOOGLE_REDIRECT_URL,
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from './api'

const user = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }

describe('auth api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue(user)
  })

  it('registerUser POSTs /register with the payload and returns the user', async () => {
    const payload = {
      name: 'Ana',
      apellido: null,
      email: 'ana@example.com',
      password: 'Abcdef12',
      password_confirmation: 'Abcdef12',
    }

    await expect(registerUser(payload)).resolves.toEqual(user)
    expect(apiFetch).toHaveBeenCalledWith('/register', { method: 'POST', body: payload })
  })

  it('fetchCurrentUser GETs /api/user', async () => {
    await expect(fetchCurrentUser()).resolves.toEqual(user)
    expect(apiFetch).toHaveBeenCalledWith('/api/user')
  })

  it('loginUser POSTs /login with the credentials', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined)
    const credentials = { email: 'ana@example.com', password: 'Abcdef12' }

    await expect(loginUser(credentials)).resolves.toBeUndefined()
    expect(apiFetch).toHaveBeenCalledWith('/login', { method: 'POST', body: credentials })
  })

  it('logoutUser POSTs /logout', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined)

    await expect(logoutUser()).resolves.toBeUndefined()
    expect(apiFetch).toHaveBeenCalledWith('/logout', { method: 'POST' })
  })

  it('requestPasswordReset POSTs /forgot-password and returns the status text', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ status: 'Enviado' })

    await expect(requestPasswordReset('ana@example.com')).resolves.toBe('Enviado')
    expect(apiFetch).toHaveBeenCalledWith('/forgot-password', {
      method: 'POST',
      body: { email: 'ana@example.com' },
    })
  })

  it('resetPassword POSTs /reset-password mapping passwordConfirmation and returns the status text', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ status: 'Listo' })

    await expect(
      resetPassword({
        token: 'tok',
        email: 'ana@example.com',
        password: 'Abcdef12',
        passwordConfirmation: 'Abcdef12',
      }),
    ).resolves.toBe('Listo')
    expect(apiFetch).toHaveBeenCalledWith('/reset-password', {
      method: 'POST',
      body: {
        token: 'tok',
        email: 'ana@example.com',
        password: 'Abcdef12',
        password_confirmation: 'Abcdef12',
      },
    })
  })

  it('GOOGLE_REDIRECT_URL targets the backend redirect route', () => {
    expect(GOOGLE_REDIRECT_URL).toBe(`${API_URL}/auth/google/redirect`)
  })
})
