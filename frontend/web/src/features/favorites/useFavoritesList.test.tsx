import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { listFavorites, setFavorite } from './api'
import { useFavoritesList } from './useFavoritesList'

vi.mock('./api', () => ({ listFavorites: vi.fn(), setFavorite: vi.fn() }))

const vehicle = {
  id: 12, marca: 'Toyota', modelo: 'Corolla', version: null, anio: 2021,
  precio: null, moneda: null, kilometraje: null, transmision: null,
  combustible: null, ubicacion: null, image_url: null,
}
const response = (id = 12) => ({
  data: [{ ...vehicle, id }],
  meta: { current_page: 1, per_page: 6, last_page: 2, total: 8 },
})

beforeEach(() => {
  vi.mocked(listFavorites).mockReset().mockResolvedValue(response())
  vi.mocked(setFavorite).mockReset().mockResolvedValue(undefined)
})

it('ignores stale page results after returning to the first page', async () => {
  let resolveOld!: (value: ReturnType<typeof response>) => void
  vi.mocked(listFavorites).mockResolvedValueOnce(response())
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
    .mockResolvedValueOnce(response(30))
  const { result } = renderHook(useFavoritesList)
  await waitFor(() => expect(result.current.view.status).toBe('ready'))
  act(() => result.current.setPage(2))
  expect(result.current.view.status).toBe('loading')
  act(() => result.current.setPage(1))
  await waitFor(() => expect(result.current.items[0].id).toBe(30))
  await act(async () => resolveOld(response(99)))
  expect(result.current.items[0].id).toBe(30)
  expect(result.current.page).toBe(1)
})

it('blocks duplicate removal requests and retries a failed undo as a save', async () => {
  let finishRemoval!: () => void
  vi.mocked(setFavorite).mockImplementationOnce(() => new Promise((resolve) => { finishRemoval = resolve }))
  const { result } = renderHook(useFavoritesList)
  await waitFor(() => expect(result.current.view.status).toBe('ready'))
  act(() => { void result.current.remove(vehicle); void result.current.remove(vehicle) })
  expect(setFavorite).toHaveBeenCalledExactlyOnceWith(12, false)
  expect(result.current.pendingIds).toEqual([12])
  await act(async () => finishRemoval())
  expect(result.current.pendingIds).toEqual([])
  expect(result.current.removed?.vehicle.id).toBe(12)
  vi.mocked(setFavorite).mockRejectedValueOnce(new Error('offline'))
  await act(async () => { await result.current.undo() })
  expect(result.current.actionError).toEqual({ vehicle, saved: true })
  expect(result.current.removed?.vehicle.id).toBe(12)
  await act(async () => { await result.current.retryAction() })
  expect(setFavorite).toHaveBeenLastCalledWith(12, true)
  expect(result.current.actionError).toBeNull()
  expect(result.current.removed).toBeNull()
  expect(result.current.pendingIds).toEqual([])
})
