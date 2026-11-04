import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { apiFetch } from '../../lib/http'
import MatchingVehicleCard from './MatchingVehicleCard'
import type { Recommendation } from './matching'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

const result: Recommendation = {
  listing_id: 7,
  score: 90,
  components: { usage: 90, body: 90, priority: null, comfort: 90 },
  resale: null,
  published_price: 10000000,
  published_currency: 'ARS',
  price_ars: 10000000,
  price_usd: null,
  budget_excess_percent: 0,
  budget_penalty: 0,
  warnings: [],
  vehicle: { marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021,
    kilometraje: 62000, ubicacion: 'CABA', transmision: 'automatica', combustible: 'nafta', carroceria: 'Sedán', image_url: null },
  dealer: { id: 2, nombre: 'Autos del Sur', provincia: 'CABA' },
}

it('shows the owner-supplied saved state and saves from a recommendation card', async () => {
  vi.mocked(apiFetch).mockResolvedValue(undefined)
  render(<MemoryRouter><MatchingVehicleCard result={{ ...result, is_favorite: true }} /></MemoryRouter>)

  const button = screen.getByRole('button', { name: 'Quitar Toyota Corolla XEI 2021 de favoritos' })
  expect(button).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(button)
  expect(apiFetch).toHaveBeenCalledExactlyOnceWith('/api/favoritos/7', { method: 'DELETE' })
  expect(screen.getByRole('button', { name: 'Guardar Toyota Corolla XEI 2021 en favoritos' })).toHaveAttribute('aria-pressed', 'false')
})

it('saves an unsaved recommendation through the same API action', async () => {
  vi.mocked(apiFetch).mockResolvedValue(undefined)
  render(<MemoryRouter><MatchingVehicleCard result={result} /></MemoryRouter>)

  await userEvent.click(screen.getByRole('button', { name: 'Guardar Toyota Corolla XEI 2021 en favoritos' }))

  expect(apiFetch).toHaveBeenCalledExactlyOnceWith('/api/favoritos/7', { method: 'PUT' })
})
