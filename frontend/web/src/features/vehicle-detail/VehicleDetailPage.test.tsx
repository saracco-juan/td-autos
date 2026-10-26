import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { vehicle } from '@shared/vehicles/fixtures'
import { apiFetch, HttpError, NetworkError } from '../../lib/http'
import VehicleDetailPage from './VehicleDetailPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))
const response = { vehicle, dealer: { id: 2, nombre: 'Autos del Sur', provincia: 'CABA' } }
const mount = (path = '/vehiculos/7') => render(
  <MemoryRouter initialEntries={[path]}>
    <Link to="/vehiculos/8">Otro vehículo</Link>
    <Routes><Route path="/vehiculos/:id" element={<VehicleDetailPage />} /></Routes>
  </MemoryRouter>,
)

beforeEach(() => { vi.mocked(apiFetch).mockReset().mockResolvedValue(response) })

it('HU09 / TC-26 loads current detail and connects only existing functionality', async () => {
  mount()
  const heading = await screen.findByRole('heading', { name: 'Toyota Corolla XEI 2021' })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/7')
  expect(screen.getByText('$ 28.900.000')).toBeInTheDocument()
  expect(screen.getByText(/Autos del Sur/)).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Foto 1 de Toyota Corolla XEI 2021' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'CHECKLIST DE INSPECCIÓN' })).toHaveAttribute('href', '/vehiculos/7/inspeccion')
  expect(screen.getByRole('button', { name: 'CALCULAR COSTOS' })).toBeDisabled()
  expect(screen.queryByRole('link', { name: 'CALCULAR COSTOS' })).not.toBeInTheDocument()
  expect(screen.queryByText('COMPARAR')).not.toBeInTheDocument()
})

it('HU09 / TC-27 explains missing price, currency, photos and facts', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...response,
    vehicle: { ...vehicle, precio: null, moneda: null, fotos: [], motor: null, descripcion: null } })
  mount()
  expect(await screen.findByText('Precio no disponible.')).toBeInTheDocument()
  expect(screen.getByText('Fotos no disponibles.')).toBeInTheDocument()
  expect(screen.getByText('Descripción no disponible.')).toBeInTheDocument()
  expect(screen.getByText('Motor').parentElement).toHaveTextContent('No disponible')
})

it.each(['0', '-1', 'wrong'])('rejects invalid id %s without requesting data', async (id) => {
  mount(`/vehiculos/${id}`)
  expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeInTheDocument()
  expect(apiFetch).not.toHaveBeenCalled()
})

it('HU09 / TC-77 shows unavailable instead of cached or fabricated vehicle data', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new HttpError(404, {}))
  mount()
  expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeInTheDocument()
  expect(screen.queryByText('Toyota Corolla XEI 2021')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'CALCULAR COSTOS' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a recomendados' })).toHaveAttribute('href', '/recomendaciones')
})

it.each([new NetworkError('offline'), new HttpError(500, {})])('retries a failed current-detail request', async (error) => {
  vi.mocked(apiFetch).mockRejectedValueOnce(error).mockResolvedValue(response)
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByRole('heading', { name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(2)
})

it('does not show the previous vehicle or accept its late response after an id change', async () => {
  let resolveFirst!: (value: typeof response) => void
  let resolveSecond!: (value: typeof response) => void
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
  mount()
  await userEvent.click(screen.getByRole('link', { name: 'Otro vehículo' }))
  await act(async () => { resolveFirst(response) })
  expect(screen.queryByText('Toyota Corolla XEI 2021')).not.toBeInTheDocument()
  await act(async () => { resolveSecond({ ...response, vehicle: { ...vehicle, id: 8, modelo: 'Etios' } }) })
  expect(await screen.findByRole('heading', { name: 'Toyota Etios XEI 2021' })).toBeInTheDocument()
  expect(apiFetch).toHaveBeenLastCalledWith('/api/vehiculos/8')
})
