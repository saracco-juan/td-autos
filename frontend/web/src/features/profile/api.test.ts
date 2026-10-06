import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '../../lib/http'
import { updateProfile } from './api'

const user = {
  id: 1,
  name: 'Ana',
  apellido: 'Pérez',
  email: 'ana@example.com',
  rol: 'comprador',
  perfil_completo: true,
  tiene_diagnostico: true,
}

describe('profile api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue(user)
  })

  it('updateProfile PUTs /api/user with the values and returns the user', async () => {
    const values = { name: 'Ana', apellido: 'Pérez' }

    await expect(updateProfile(values)).resolves.toEqual(user)
    expect(apiFetch).toHaveBeenCalledWith('/api/user', { method: 'PUT', body: values })
  })
})
