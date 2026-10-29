import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { setFavorite } from './api'
import { useFavorite } from './useFavorite'

vi.mock('./api', () => ({ setFavorite: vi.fn() }))

it('updates optimistically, ignores overlapping toggles, and rolls back with an error', async () => {
  let rejectSave!: (error: Error) => void
  vi.mocked(setFavorite).mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject }))
  const { result } = renderHook(() => useFavorite(7, false))

  act(() => { void result.current.toggle() })
  expect(result.current.isFavorite).toBe(true)
  expect(result.current.pending).toBe(true)
  act(() => { void result.current.toggle() })
  expect(setFavorite).toHaveBeenCalledExactlyOnceWith(7, true)

  await act(async () => { rejectSave(new Error('offline')) })
  await waitFor(() => expect(result.current.pending).toBe(false))
  expect(result.current.isFavorite).toBe(false)
  expect(result.current.error).toBe('No se pudo actualizar el favorito. Intentá de nuevo.')
})
