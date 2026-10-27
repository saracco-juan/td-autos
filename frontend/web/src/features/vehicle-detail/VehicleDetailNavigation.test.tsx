import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { vehicle } from '@shared/vehicles/fixtures'
import { apiFetch, HttpError } from '../../lib/http'
import OwnershipCostsPage from '../costs/OwnershipCostsPage'
import MatchingRecommendationsPage from '../recommendations/MatchingRecommendationsPage'
import VehicleDetailPage from './VehicleDetailPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))
const recommendation = {
  listing_id: 7, score: 88.5, components: { usage: 90, body: 100, comfort: 60, priority: null },
  published_price: 28900000, published_currency: 'ARS', price_ars: 28900000, price_usd: null,
  budget_excess_percent: 0, budget_penalty: 0, warnings: [],
  vehicle: { ...vehicle, image_url: null }, dealer: { id: 2, nombre: 'Autos del Sur', provincia: 'CABA' },
}
const context = { listingId: 7, score: 88.5, factors: recommendation.components,
  returnTo: '/recomendaciones?maxPrice=30000000&transmission=automatica' }

function CurrentLocation() {
  const location = useLocation()
  return <output aria-label="Ruta actual">{location.pathname}{location.search}</output>
}

function mount(path = context.returnTo, state?: unknown) {
  render(<MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}>
    <CurrentLocation />
    <Routes>
      <Route path="/recomendaciones" element={<MatchingRecommendationsPage />} />
      <Route path="/vehiculos/:id" element={<VehicleDetailPage />} />
      <Route path="/vehiculos/:id/costos" element={<OwnershipCostsPage />} />
    </Routes>
  </MemoryRouter>)
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockImplementation(async (path) => path === '/api/recomendaciones'
    ? { status: 'ready', results: [recommendation], exchange_rate: null }
    : { vehicle: { ...vehicle, precio: 30000000 }, dealer: recommendation.dealer })
})

it('HU09 keeps VER FICHA primary, the existing costs shortcut, current facts and filters on return', async () => {
  mount()
  await userEvent.click(await screen.findByRole('link', { name: 'VER FICHA' }))
  expect(await screen.findByRole('heading', { name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
  expect(screen.getByText('$ 30.000.000')).toBeInTheDocument()
  expect(screen.getByText('88,5% de compatibilidad')).toBeInTheDocument()
  expect(screen.getByText('Prioridad principal: no disponible')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'CALCULAR COSTOS' })).toHaveAttribute('href', '/vehiculos/7/costos')
  const back = screen.getByRole('link', { name: 'Volver a recomendados' })
  expect(back).toHaveAttribute('href', context.returnTo)
  await userEvent.click(back)
  expect(await screen.findByRole('link', { name: 'VER FICHA' })).toHaveAttribute('href', '/vehiculos/7')
  expect(screen.queryByRole('link', { name: 'CALCULAR COSTOS' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent(context.returnTo)
  expect(screen.getByText('Mostrando 1 vehículo')).toBeInTheDocument()
})

it('UH-10 goes from the detail to its costs and back without losing the recommendation context', async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (String(path).startsWith('/api/vehiculos/7/costos')) throw new HttpError(503, {})
    return { vehicle: { ...vehicle, precio: 30000000 }, dealer: recommendation.dealer }
  })
  mount('/vehiculos/7', { vehicleDetail: context })
  await userEvent.click(await screen.findByRole('link', { name: 'CALCULAR COSTOS' }))
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/vehiculos/7/costos')
  await userEvent.click(await screen.findByRole('link', { name: 'Volver a la ficha' }))
  expect(await screen.findByText('88,5% de compatibilidad')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a recomendados' })).toHaveAttribute('href', context.returnTo)
})

it.each([
  { ...context, listingId: 8 },
  { ...context, returnTo: 'https://example.test' },
  { ...context, factors: null },
])('does not trust mismatched or invalid navigation context', async (invalid) => {
  mount('/vehiculos/7', { vehicleDetail: invalid })
  expect(await screen.findByRole('heading', { name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
  expect(screen.queryByText('88,5% de compatibilidad')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a recomendados' })).toHaveAttribute('href', '/recomendaciones')
})

it('TC-77 never uses recommendation context as a fallback for an unavailable detail', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new HttpError(404, {}))
  mount('/vehiculos/7', { vehicleDetail: context })
  expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeInTheDocument()
  expect(screen.queryByText('88,5% de compatibilidad')).not.toBeInTheDocument()
  expect(screen.queryByText('$ 28.900.000')).not.toBeInTheDocument()
})
