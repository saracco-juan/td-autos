import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { listFavorites, setFavorite } from './api'
import FavoritesPage from './FavoritesPage'

vi.mock('./api', () => ({ listFavorites: vi.fn(), setFavorite: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../recommendations/matching', () => ({ fetchRecommendations: vi.fn().mockRejectedValue(new Error('offline')) }))
afterEach(() => { cleanup(); vi.mocked(listFavorites).mockReset(); vi.mocked(setFavorite).mockClear() })
const vehicle = (id: number) => ({ id, marca: 'Toyota', modelo: `Car${id}`, version: null, anio: 2021, precio: 1, moneda: 'ARS' as const, kilometraje: 1, transmision: 'automatica' as const, combustible: 'nafta' as const, ubicacion: 'CABA', image_url: null })
const response = (id: number, page: number, total = 8, lastPage = 2) => ({ data: [vehicle(id)], meta: { current_page: page, per_page: 6, total, last_page: lastPage } })

it('ignores an older page response after navigation returns to page one', async () => {
  let resolveOld!: (value: ReturnType<typeof response>) => void
  vi.mocked(listFavorites).mockResolvedValueOnce(response(1, 1)).mockImplementationOnce(() => new Promise((done) => { resolveOld = done })).mockResolvedValueOnce(response(3, 1))
  render(<MemoryRouter><FavoritesPage /></MemoryRouter>)
  const user = userEvent.setup()
  await screen.findByText('Toyota Car1 2021')
  await user.click(screen.getByRole('button', { name: 'Página 2' }))
  await user.click(screen.getByRole('button', { name: 'Página 1' }))
  await screen.findByText('Toyota Car3 2021')
  await act(async () => resolveOld(response(2, 2)))
  expect(screen.getByText('Toyota Car3 2021')).toBeInTheDocument()
  expect(screen.queryByText('Toyota Car2 2021')).not.toBeInTheDocument()
})

it('falls back to the last existing page when a removal empties page two', async () => {
  vi.mocked(listFavorites).mockResolvedValueOnce(response(1, 1)).mockResolvedValueOnce(response(2, 2)).mockResolvedValueOnce({ data: [], meta: { current_page: 2, per_page: 6, total: 6, last_page: 1 } }).mockResolvedValueOnce(response(1, 1, 6, 1))
  render(<MemoryRouter><FavoritesPage /></MemoryRouter>)
  const user = userEvent.setup()
  await screen.findByText('Toyota Car1 2021')
  await user.click(screen.getByRole('button', { name: 'Página 2' }))
  await screen.findByText('Toyota Car2 2021')
  await user.click(screen.getByRole('button', { name: 'QUITAR' }))
  expect(await screen.findByText('Toyota Car1 2021')).toBeInTheDocument()
  expect(vi.mocked(listFavorites)).toHaveBeenLastCalledWith({ page: 1, perPage: 6 })
  expect(setFavorite).toHaveBeenCalledWith(2, false)
})
