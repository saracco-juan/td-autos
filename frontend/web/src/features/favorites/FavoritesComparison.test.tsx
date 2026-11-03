import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, it, vi } from 'vitest'
import { listFavorites, setFavorite } from './api'
import FavoritesPage from './FavoritesPage'

vi.mock('./api', () => ({ listFavorites: vi.fn(), setFavorite: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../recommendations/matching', () => ({ fetchRecommendations: vi.fn().mockRejectedValue(new Error('offline')) }))

const vehicle = (id: number) => ({ id, marca: 'Toyota', modelo: `Auto ${id}`, version: null, anio: 2021,
  precio: 100, moneda: 'USD' as const, kilometraje: 1000, transmision: null, combustible: null,
  ubicacion: 'CABA', image_url: null })
const response = (ids: number[]) => ({ data: ids.map(vehicle),
  meta: { current_page: 1, per_page: 6, last_page: 1, total: ids.length } })
function Destination() { return <p>{useLocation().search}</p> }
function mount(path = '/favoritos') {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/favoritos" element={<FavoritesPage />} />
    <Route path="/comparar" element={<Destination />} />
  </Routes></MemoryRouter>)
}

it('waits for the second selected card before automatically comparing saved vehicles', async () => {
  vi.mocked(listFavorites).mockResolvedValue(response([1, 2, 3]))
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Comparar Toyota Auto 1 2021' }))
  const heading = screen.getByRole('heading', { name: 'Vehículos guardados' }).closest('header')!
  expect(within(heading).getByRole('link', { name: 'VER RECOMENDADOS' })).toHaveAttribute('href', '/recomendaciones')
  await user.click(screen.getByRole('button', { name: 'COMPARAR' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Seleccioná exactamente dos vehículos')
  await user.click(screen.getByRole('button', { name: 'Comparar Toyota Auto 2 2021' }))
  expect(screen.queryByText('?compare=1%2C2&source=favorites')).not.toBeInTheDocument()
  fireEvent.transitionEnd(screen.getByRole('button', { name: 'Dejar de comparar Toyota Auto 2 2021' }).closest('[data-position]')!, { propertyName: 'transform' })
  expect(await screen.findByText('?compare=1%2C2&source=favorites')).toBeInTheDocument()
})

it('does not automatically reopen comparison when returning with two selected vehicles', async () => {
  vi.mocked(listFavorites).mockResolvedValue(response([1, 2]))
  mount('/favoritos?compare=1,2')
  await screen.findByText('2/2 seleccionados')
  await new Promise((resolve) => setTimeout(resolve, 750))
  expect(screen.getByRole('heading', { name: 'Vehículos guardados' })).toBeInTheDocument()
})

it('cancels automatic comparison when either selected vehicle is deselected', async () => {
  vi.mocked(listFavorites).mockResolvedValue(response([1, 2]))
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Comparar Toyota Auto 1 2021' }))
  await user.click(screen.getByRole('button', { name: 'Comparar Toyota Auto 2 2021' }))
  await user.click(screen.getByRole('button', { name: 'Dejar de comparar Toyota Auto 1 2021' }))
  await new Promise((resolve) => setTimeout(resolve, 750))
  expect(screen.getByText('1/2 seleccionados')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Vehículos guardados' })).toBeInTheDocument()
})

it('clears a removed favorite from comparison without conflating selection and saved state', async () => {
  vi.mocked(listFavorites).mockResolvedValueOnce(response([1, 2])).mockResolvedValue(response([2]))
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Comparar Toyota Auto 1 2021' }))
  expect(screen.getByText('1/2 seleccionados')).toBeInTheDocument()
  await user.click(within(screen.getByRole('group', { name: 'Acciones de Toyota Auto 1 2021' })).getByRole('button', { name: 'QUITAR' }))
  expect(await screen.findByText('0/2 seleccionados')).toBeInTheDocument()
  expect(setFavorite).toHaveBeenCalledWith(1, false)
  expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled()
})
