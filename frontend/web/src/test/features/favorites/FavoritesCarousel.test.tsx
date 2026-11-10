import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { ComponentProps } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { FavoriteVehicle } from '@shared/favorites/types'
import FavoritesCarousel from '../../../features/favorites/components/FavoritesCarousel'

const items: FavoriteVehicle[] = [1, 2, 3].map((id) => ({
  id, marca: 'Toyota', modelo: `Modelo ${id}`, version: 'XEI', anio: 2021,
  precio: 1000000, moneda: 'ARS', kilometraje: 30000, transmision: 'automatica',
  combustible: 'nafta', ubicacion: 'CABA', image_url: null,
}))
const props = (overrides: Partial<ComponentProps<typeof FavoritesCarousel>> = {}) => ({
  items, matches: [], selectedIds: [], pendingIds: [], onToggle: vi.fn(), onRemove: vi.fn(),
  ...overrides,
})

beforeEach(() => vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false })))

it.each([2, 3, 4, 5, 6])('keeps all %i favorites in the orbit while navigating', (count) => {
  const vehicles = Array.from({ length: count }, (_, index) => ({ ...items[0], id: index + 1, modelo: `Modelo ${index + 1}` }))
  const { container } = render(<MemoryRouter><FavoritesCarousel {...props({ items: vehicles })} /></MemoryRouter>)
  for (let step = 0; step < count; step += 1) {
    expect(container.querySelectorAll('[data-position="hidden"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-position^="side-"]')).toHaveLength(count - 1)
    expect(screen.getByRole('region', { name: 'Carrusel de favoritos' })).toHaveAttribute('data-current-id', String(step + 1))
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente favorito' }))
  }
})

it('keeps orbit angles and transform structure stable when a side card is selected', () => {
  const { container, rerender } = render(<MemoryRouter><FavoritesCarousel {...props()} /></MemoryRouter>)
  const transforms = Array.from(container.querySelectorAll<HTMLElement>('[data-position]'), (card) => card.style.transform)
  rerender(<MemoryRouter><FavoritesCarousel {...props({ selectedIds: [2] })} /></MemoryRouter>)
  const cards = container.querySelectorAll<HTMLElement>('[data-position]')
  expect(cards[0].style.transform).toBe(transforms[0])
  expect(cards[2].style.transform).toBe(transforms[2])
  expect(cards[1].style.transform.match(/(?:translateZ?|rotateY)\(/g)).toEqual(transforms[1].match(/(?:translateZ?|rotateY)\(/g))
})

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

it('keeps carousel navigation on its native controls for keyboard users', () => {
  render(<MemoryRouter><FavoritesCarousel {...props()} /></MemoryRouter>)
  const region = screen.getByRole('region', { name: 'Carrusel de favoritos' })
  const next = screen.getByRole('button', { name: 'Siguiente favorito' })
  expect(region).toHaveAttribute('data-current-id', '1')
  expect(region).not.toHaveAttribute('tabindex')
  fireEvent.click(next)
  expect(region).toHaveAttribute('data-current-id', '2')
  fireEvent.keyDown(screen.getByRole('button', { name: 'Anterior favorito' }), { key: 'ArrowLeft' })
  expect(region).toHaveAttribute('data-current-id', '1')
})

it('keeps complete turns when crossing the last and first cards in either direction', () => {
  render(<MemoryRouter><FavoritesCarousel {...props()} /></MemoryRouter>)
  const region = screen.getByRole('region', { name: 'Carrusel de favoritos' })
  fireEvent.click(screen.getByRole('button', { name: 'Anterior favorito' }))
  expect(region).toHaveAttribute('data-current-id', '3')
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente favorito' }))
  expect(region).toHaveAttribute('data-current-id', '1')
  for (let step = 0; step < items.length; step += 1) fireEvent.click(screen.getByRole('button', { name: 'Siguiente favorito' }))
  const front = screen.getByRole('listitem', { name: /Modelo 1/ }).closest('[data-position="front"]') as HTMLElement
  expect(front.style.transform).toContain('rotateY(-360deg)')
  expect(front.style.transform).toContain('rotateY(360deg)')
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

it('provides two selected upper slots', () => {
  const { rerender } = render(<MemoryRouter><FavoritesCarousel {...props()} /></MemoryRouter>)
  rerender(<MemoryRouter><FavoritesCarousel {...props({ selectedIds: [1, 2] })} /></MemoryRouter>)
  const selected = screen.getByRole('listitem', { name: /Modelo 1/ }).closest('[data-position="selected-0"]')
  expect(selected).toBeInTheDocument()
  expect(screen.getByRole('listitem', { name: /Modelo 2/ }).closest('[data-position="selected-1"]')).toBeInTheDocument()
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
