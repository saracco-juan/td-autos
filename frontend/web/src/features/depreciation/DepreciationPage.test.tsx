import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { vehicle } from '@shared/vehicles/fixtures'
import type { DepreciationResponse } from '@shared/depreciation/types'
import { apiFetch, HttpError, NetworkError } from '../../lib/http'
import VehicleDetailPage from '../vehicle-detail/VehicleDetailPage'
import DepreciationPage from './DepreciationPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))
const response: DepreciationResponse = { vehicle, projection: { current_value: 20000, currency: 'USD',
  annual_depreciation_percent: 10, points: [{ years: 1, value: 18000, retained_percent: 90 },
    { years: 3, value: 14580, retained_percent: 72.9 }, { years: 5, value: 11809.8, retained_percent: 59.049 }] },
  reference: { source_date: '2026-10-19', years_used: [2020, 2021, 2022], reference_count: 1,
    approximate_model: null, stale: false } }

function mount(path = '/vehiculos/7/depreciacion') {
  return render(<MemoryRouter initialEntries={[{ pathname: path, state: { returnTo: '/favoritos' } }]}>
    <Link to="/vehiculos/8/depreciacion">Otro vehículo</Link>
    <Routes>
      <Route path="/vehiculos/:id" element={<VehicleDetailPage />} />
      <Route path="/vehiculos/:id/depreciacion" element={<DepreciationPage />} />
      <Route path="/favoritos" element={<h1>Mis favoritos</h1>} />
    </Routes>
  </MemoryRouter>)
}

beforeEach(() => { vi.mocked(apiFetch).mockReset().mockResolvedValue(response) })

it('TC-40 enters from detail and preserves the return to favorites', async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => path.endsWith('/depreciacion') ? response
    : { vehicle, dealer: { id: 2, nombre: 'Autos del Sur' } })
  mount('/vehiculos/7')
  await userEvent.click(await screen.findByRole('link', { name: 'DEPRECIACIÓN Y REVENTA' }))
  expect(await screen.findByRole('table', { name: 'Valor proyectado' })).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/7/depreciacion')
  await userEvent.click(screen.getByRole('link', { name: 'Volver a la ficha' }))
  await userEvent.click(await screen.findByRole('link', { name: 'Volver a favoritos' }))
  expect(screen.getByRole('heading', { name: 'Mis favoritos' })).toBeInTheDocument()
})

it('TC-41 shows a normal informative state with no chart, values or error alert', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...response, projection: null, reference: null })
  mount()
  expect(await screen.findByText('No hay datos suficientes para estimar la depreciación.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'REINTENTAR' })).not.toBeInTheDocument()
})

it.each([new NetworkError('offline'), new HttpError(500, {})])('retries a real request failure', async (error) => {
  vi.mocked(apiFetch).mockRejectedValueOnce(error).mockResolvedValue(response)
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByRole('table')).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(2)
})

it('keeps a withdrawn vehicle distinct from insufficient reference data', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new HttpError(404, {}))
  mount()
  expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it.each(['wrong', '0', '-1'])('does not fetch an invalid vehicle id: %s', async (id) => {
  mount(`/vehiculos/${id}/depreciacion`)
  expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeInTheDocument()
  expect(apiFetch).not.toHaveBeenCalled()
})

it('ignores a late result after navigation to another vehicle', async () => {
  let resolveFirst!: (value: DepreciationResponse) => void
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    .mockResolvedValueOnce({ ...response, vehicle: { ...vehicle, id: 8, modelo: 'Etios' } })
  mount()
  await userEvent.click(screen.getByRole('link', { name: 'Otro vehículo' }))
  expect(await screen.findByRole('heading', { name: 'Toyota Etios XEI 2021' })).toBeInTheDocument()
  await act(async () => { resolveFirst(response) })
  expect(screen.queryByRole('heading', { name: 'Toyota Corolla XEI 2021' })).not.toBeInTheDocument()
})
