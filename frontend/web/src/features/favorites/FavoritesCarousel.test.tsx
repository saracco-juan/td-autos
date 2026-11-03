import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { ComponentProps } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { FavoriteVehicle } from '@shared/favorites/types'
import FavoritesCarousel from './FavoritesCarousel'

const items: FavoriteVehicle[] = [1, 2, 3].map((id) => ({
  id, marca: 'Toyota', modelo: `Modelo ${id}`, version: 'XEI', anio: 2021,
  precio: 1000000, moneda: 'ARS', kilometraje: 30000, transmision: 'automatica',
  combustible: 'nafta', ubicacion: 'CABA', image_url: null,
}))
const props = (overrides: Partial<ComponentProps<typeof FavoritesCarousel>> = {}) => ({
  items, matches: [], selectedIds: [], pendingIds: [], onToggle: vi.fn(), onRemove: vi.fn(),
  onSelectionSettled: vi.fn(), ...overrides,
})

beforeEach(() => vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false })))

it('shows every favorite as an actionable grid card on smaller screens', () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === '(max-width: 1100px)' })))
  const onToggle = vi.fn()
  render(<MemoryRouter><FavoritesCarousel {...props({ onToggle })} /></MemoryRouter>)
  expect(screen.getByRole('list', { name: 'Vehículos favoritos' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Carrusel de favoritos' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Siguiente favorito' })).not.toBeInTheDocument()
  items.forEach((item) => expect(screen.getByRole('button', { name: `Comparar Toyota Modelo ${item.id} XEI 2021` })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Comparar Toyota Modelo 3 XEI 2021' }))
  expect(onToggle).toHaveBeenCalledWith(3)
})

it('navigates the current card with controls and keyboard', () => {
  render(<MemoryRouter><FavoritesCarousel {...props()} /></MemoryRouter>)
  expect(screen.getByRole('region', { name: 'Carrusel de favoritos' })).toHaveAttribute('data-current-id', '1')
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente favorito' }))
  expect(screen.getByRole('region', { name: 'Carrusel de favoritos' })).toHaveAttribute('data-current-id', '2')
  fireEvent.keyDown(screen.getByRole('region', { name: 'Carrusel de favoritos' }), { key: 'ArrowLeft' })
  expect(screen.getByRole('region', { name: 'Carrusel de favoritos' })).toHaveAttribute('data-current-id', '1')
})

it('skips selected cards while navigating', () => {
  render(<MemoryRouter><FavoritesCarousel {...props({ selectedIds: [2] })} /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente favorito' }))
  expect(screen.getByRole('region', { name: 'Carrusel de favoritos' })).toHaveAttribute('data-current-id', '3')
})

it('keeps side-card actions inert until that card is brought forward', () => {
  render(<MemoryRouter><FavoritesCarousel {...props()} /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'Comparar Toyota Modelo 1 XEI 2021' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Comparar Toyota Modelo 2 XEI 2021' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ver Toyota Modelo 2 XEI 2021' }))
  expect(screen.getByRole('button', { name: 'Comparar Toyota Modelo 2 XEI 2021' })).toBeInTheDocument()
})

it('provides two selected upper slots and signals settled selected transforms', async () => {
  const onSelectionSettled = vi.fn()
  const { rerender } = render(<MemoryRouter><FavoritesCarousel {...props({ onSelectionSettled })} /></MemoryRouter>)
  rerender(<MemoryRouter><FavoritesCarousel {...props({ selectedIds: [1, 2], onSelectionSettled })} /></MemoryRouter>)
  expect(screen.getByRole('group', { name: 'Vehículos seleccionados' })).toBeInTheDocument()
  const selected = screen.getByRole('listitem', { name: /Modelo 1/ }).closest('[data-position="selected-0"]')
  expect(selected).toBeInTheDocument()
  fireEvent.transitionEnd(selected!.querySelector('li')!, { propertyName: 'transform' })
  expect(onSelectionSettled).not.toHaveBeenCalled()
  fireEvent.transitionEnd(selected!, { propertyName: 'transform' })
  expect(onSelectionSettled).toHaveBeenCalledWith(1)
})

it('moves the next unselected favorite to the front while keeping selected actions available', () => {
  const input = props({ selectedIds: [1] })
  render(<MemoryRouter><FavoritesCarousel {...input} /></MemoryRouter>)
  expect(screen.getByRole('region', { name: 'Carrusel de favoritos' })).toHaveAttribute('data-current-id', '2')
  expect(screen.getByRole('button', { name: 'Dejar de comparar Toyota Modelo 1 XEI 2021' })).toBeInTheDocument()
})

it('keeps upper slots in selection order instead of inventory order', () => {
  render(<MemoryRouter><FavoritesCarousel {...props({ selectedIds: [2, 1] })} /></MemoryRouter>)
  expect(screen.getByRole('listitem', { name: /Modelo 2/ }).closest('[data-position]')).toHaveAttribute('data-position', 'selected-0')
  expect(screen.getByRole('listitem', { name: /Modelo 1/ }).closest('[data-position]')).toHaveAttribute('data-position', 'selected-1')
})

it('settles selections immediately when reduced motion is preferred', async () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  const onSelectionSettled = vi.fn()
  const { rerender } = render(<MemoryRouter><FavoritesCarousel {...props({ onSelectionSettled })} /></MemoryRouter>)
  rerender(<MemoryRouter><FavoritesCarousel {...props({ selectedIds: [1], onSelectionSettled })} /></MemoryRouter>)
  await waitFor(() => expect(onSelectionSettled).toHaveBeenCalledWith(1))
})
