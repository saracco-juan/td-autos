import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch } from '../../lib/http'
import { fetchCosts } from './api'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))

beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockResolvedValue({})
})

it('asks for the vehicle costs without parameters so the backend applies the diagnosis', async () => {
  await fetchCosts(7)
  expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/7/costos')
})

it('sends km and cobertura as query parameters', async () => {
  await fetchCosts(7, { km: 2000, coverage: 'todo_riesgo' })
  expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/7/costos?km=2000&cobertura=todo_riesgo')
})
