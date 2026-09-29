import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { API_URL } from '../../lib/config'
import { apiFetch } from '../../lib/http'
import { GOOGLE_REDIRECT_URL, fetchCurrentUser, registerUser } from './api'

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

  it('GOOGLE_REDIRECT_URL targets the backend redirect route', () => {
    expect(GOOGLE_REDIRECT_URL).toBe(`${API_URL}/auth/google/redirect`)
  })
})
