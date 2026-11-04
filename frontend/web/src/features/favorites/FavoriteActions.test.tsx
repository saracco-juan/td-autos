import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { listFavorites, setFavorite } from './api'
import FavoritesPage from './FavoritesPage'

vi.mock('./api', () => ({ listFavorites: vi.fn(), setFavorite: vi.fn() }))
vi.mock('../recommendations/matching', () => ({ fetchRecommendations: vi.fn().mockResolvedValue({ results: [] }) }))

const vehicle = {
  id: 12, marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021,
  precio: 28900000, moneda: 'ARS' as const, kilometraje: 62000,
  transmision: 'automatica' as const, combustible: 'nafta' as const, ubicacion: 'CABA', image_url: null,
}
const response = (saved: boolean) => ({
  data: saved ? [vehicle] : [],
  meta: { current_page: 1, per_page: 6, last_page: 1, total: saved ? 1 : 0 },
})

beforeEach(() => {
  vi.mocked(listFavorites).mockReset().mockResolvedValueOnce(response(true)).mockResolvedValue(response(false))
  vi.mocked(setFavorite).mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

it('retries the failed undo as a save, preserving the removal feedback until it succeeds', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><FavoritesPage /></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: 'QUITAR' }))
  await screen.findByText('Todavía no guardaste vehículos')
  vi.mocked(setFavorite).mockRejectedValueOnce(new Error('offline'))
  await user.click(screen.getByRole('button', { name: 'Deshacer' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled()

  vi.mocked(listFavorites).mockResolvedValue(response(true))
  await user.click(screen.getByRole('button', { name: 'REINTENTAR' }))
  expect(setFavorite).toHaveBeenLastCalledWith(12, true)
  expect(await screen.findByRole('heading', { name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument()
})

it('offers a retry when the list refresh fails after a successful removal', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><FavoritesPage /></MemoryRouter>)
  await screen.findByRole('button', { name: 'QUITAR' })
  vi.mocked(listFavorites).mockRejectedValueOnce(new Error('offline'))
  await user.click(screen.getByRole('button', { name: 'QUITAR' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'REINTENTAR' }))
  await waitFor(() => expect(screen.getByText('Todavía no guardaste vehículos')).toBeInTheDocument())
  expect(setFavorite).toHaveBeenCalledExactlyOnceWith(12, false)
})
