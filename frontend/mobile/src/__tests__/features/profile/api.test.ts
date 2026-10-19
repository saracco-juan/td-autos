import { updateProfile } from '../../../features/profile/api'
import { apiFetch } from '../../../lib/http'

jest.mock('../../../lib/http', () => ({ apiFetch: jest.fn() }))

const apiFetchMock = jest.mocked(apiFetch)

describe('profile api', () => {
  it('updates nombre and apellido with the bearer token and returns the user', async () => {
    const user = { id: 1, name: 'Ana', apellido: 'Pérez', email: 'ana@example.com', rol: 'comprador' }
    apiFetchMock.mockResolvedValue(user)

    await expect(updateProfile({ name: 'Ana', apellido: 'Pérez' }, 'tok')).resolves.toBe(user)
    expect(apiFetchMock).toHaveBeenCalledWith('/api/user', {
      method: 'PUT',
      body: { name: 'Ana', apellido: 'Pérez' },
      token: 'tok',
    })
  })
})
