import { expect, it, vi } from 'vitest'
import { apiFetch } from '../../lib/http'
import { fetchRecommendations } from './matching'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

it('HU05 reads the current-user ranking without sending identity, scores or filters', async () => {
  const response = { status: 'ready', results: [], exchange_rate: null }
  vi.mocked(apiFetch).mockResolvedValue(response)
  await expect(fetchRecommendations()).resolves.toBe(response)
  expect(apiFetch).toHaveBeenCalledExactlyOnceWith('/api/recomendaciones')
})
