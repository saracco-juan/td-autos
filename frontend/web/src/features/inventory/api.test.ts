import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '../../lib/http'
import { deleteVehicle, fetchVehicles } from './api'
import { VEHICULOS } from './fixtures'

describe('inventory api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('fetchVehicles GETs the dealer vehicles and returns the list', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ vehiculos: VEHICULOS })

    await expect(fetchVehicles()).resolves.toEqual(VEHICULOS)
    expect(apiFetch).toHaveBeenCalledWith('/api/concesionaria/vehiculos')
  })

  it('deleteVehicle sends a DELETE for that vehicle', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined)

    await expect(deleteVehicle(7)).resolves.toBeUndefined()
    expect(apiFetch).toHaveBeenCalledWith('/api/concesionaria/vehiculos/7', { method: 'DELETE' })
  })

  it('lets the errors of apiFetch propagate', async () => {
    const failure = new Error('HTTP 500')
    vi.mocked(apiFetch).mockRejectedValue(failure)

    await expect(fetchVehicles()).rejects.toBe(failure)
    await expect(deleteVehicle(1)).rejects.toBe(failure)
  })
})
