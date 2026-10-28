import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch } from '../../lib/http'
import { listFavorites, setFavorite } from './api'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))
beforeEach(() => { vi.mocked(apiFetch).mockReset().mockResolvedValue(undefined) })

it('HU11 reads the saved list with its pagination and optional visible vehicle IDs', async () => {
  await listFavorites()
  expect(apiFetch).toHaveBeenLastCalledWith('/api/favoritos')
  await listFavorites({ page: 2, perPage: 12, ids: [7, 9] })
  expect(apiFetch).toHaveBeenLastCalledWith('/api/favoritos?page=2&per_page=12&ids%5B%5D=7&ids%5B%5D=9')
})

it('TC-31 and TC-32 explicitly save or remove through the same authenticated HTTP client', async () => {
  await setFavorite(7, true)
  expect(apiFetch).toHaveBeenLastCalledWith('/api/favoritos/7', { method: 'PUT' })
  await setFavorite(7, false)
  expect(apiFetch).toHaveBeenLastCalledWith('/api/favoritos/7', { method: 'DELETE' })
})

it('keeps request failures visible to the caller', async () => {
  const failure = new Error('offline')
  vi.mocked(apiFetch).mockRejectedValue(failure)
  await expect(setFavorite(7, true)).rejects.toBe(failure)
  await expect(listFavorites()).rejects.toBe(failure)
})
