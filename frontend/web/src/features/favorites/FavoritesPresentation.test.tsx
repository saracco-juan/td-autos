import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { fetchRecommendations, type RecommendationsResponse } from '../recommendations/matching'
import { listFavorites, setFavorite } from './api'
import FavoritesPage from './FavoritesPage'

vi.mock('./api', () => ({ listFavorites: vi.fn(), setFavorite: vi.fn() }))
vi.mock('../recommendations/matching', () => ({ fetchRecommendations: vi.fn() }))

beforeEach(() => {
  vi.mocked(listFavorites).mockResolvedValue({
    data: [{ id: 12, marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021,
      precio: 28900000, moneda: 'ARS', kilometraje: 62000, transmision: 'automatica',
      combustible: 'nafta', ubicacion: 'CABA', image_url: '/missing.jpg' }],
    meta: { current_page: 1, per_page: 6, last_page: 1, total: 1 },
  })
  vi.mocked(setFavorite).mockReset().mockResolvedValue(undefined)
  vi.mocked(fetchRecommendations).mockReset()
})

it('loads favorites before matching completes and displays only the actual current match', async () => {
  let resolve!: (value: RecommendationsResponse) => void
  vi.mocked(fetchRecommendations).mockReturnValue(new Promise((done) => { resolve = done }))
  render(<MemoryRouter><FavoritesPage /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: 'QUITAR' })).toBeEnabled()
  expect(screen.getByRole('link', { name: 'VER RECOMENDADOS' })).toHaveAttribute('href', '/recomendaciones')
  expect(screen.queryByText('MEJOR COINCIDENCIA')).not.toBeInTheDocument()
  await act(async () => resolve({ status: 'ready', exchange_rate: null, results: [{
    listing_id: 12, score: 87.5, components: { usage: 90, body: 80, comfort: 90, priority: 90 },
    published_price: 28900000, published_currency: 'ARS', price_ars: 28900000, price_usd: null,
    budget_excess_percent: 0, budget_penalty: 0, warnings: [],
    vehicle: { marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021,
      kilometraje: 62000, ubicacion: 'CABA', transmision: 'automatica', combustible: 'nafta',
      carroceria: 'Sedán', image_url: null }, dealer: { id: 1, nombre: 'Demo', provincia: null },
  }] }))
  expect(await screen.findByText('87,5% de compatibilidad')).toBeInTheDocument()
  expect(screen.getByText('MEJOR COINCIDENCIA')).toBeInTheDocument()
})

it('keeps favorites usable without matching and replaces broken images', async () => {
  vi.mocked(fetchRecommendations).mockRejectedValue(new Error('unavailable'))
  render(<MemoryRouter><FavoritesPage /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: 'QUITAR' })).toBeEnabled()
  fireEvent.error(screen.getByRole('img', { name: 'Toyota Corolla XEI 2021' }))
  expect(screen.getByText('Imagen no disponible')).toBeInTheDocument()
  expect(screen.getByText('Compatibilidad no disponible')).toBeInTheDocument()
  expect(screen.queryByText('MEJOR COINCIDENCIA')).not.toBeInTheDocument()
})
