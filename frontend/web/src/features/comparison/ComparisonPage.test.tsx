import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch, HttpError } from '../../lib/http'
import { entry } from '../../test/comparison'
import ComparisonPage from './ComparisonPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))
function respond(path: string) {
  if (path === '/api/recomendaciones') return { status: 'ready', results: [7, 8, 9].map((listing_id) => ({ listing_id, ...entry(listing_id).recommendation })) }
  const id = Number(path.split('/')[3])
  return path.endsWith('/costos') ? entry(id).costs : entry(id).detail
}
const mount = (query = 'compare=7,8') => render(<MemoryRouter initialEntries={[`/comparar?${query}`]}>
  <Routes><Route path="/comparar" element={<ComparisonPage />} /></Routes>
</MemoryRouter>)
beforeEach(() => { vi.mocked(apiFetch).mockReset().mockImplementation(async (path) => respond(path)) })

it('HU08 TC-23 loads current facts and both existing calculator endpoints without ArgAutos or overrides', async () => {
  mount()
  expect(await screen.findByRole('region', { name: 'Comparación de vehículos' })).toBeVisible()
  expect(vi.mocked(apiFetch).mock.calls.map(([path]) => path).sort()).toEqual([
    '/api/recomendaciones', '/api/vehiculos/7', '/api/vehiculos/7/costos', '/api/vehiculos/8', '/api/vehiculos/8/costos',
  ])
  expect(screen.getByRole('link', { name: /Volver a recomendados/ })).toHaveAttribute('href', '/recomendaciones?compare=7%2C8')
})

it.each(['', 'compare=7', 'compare=7,7', 'compare=7,8,9'])('HU08 TC-76 blocks incomplete/invalid selection (%s) before requesting comparison data', (query) => {
  mount(query)
  expect(screen.queryByRole('region', { name: 'Comparación de vehículos' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Seleccioná exactamente dos vehículos')
  expect(apiFetch).not.toHaveBeenCalled()
})

it('HU08 TC-25 removes one, hides the comparison and preserves the other ID and filters for replacement', async () => {
  mount('compare=7,8&maxPrice=30000000')
  await screen.findByRole('region', { name: 'Comparación de vehículos' })
  await userEvent.click(screen.getByRole('button', { name: 'Quitar Toyota Corolla XEI 2021' }))
  expect(screen.queryByRole('region', { name: 'Comparación de vehículos' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Seleccioná exactamente dos vehículos')
  expect(screen.getByRole('link', { name: /Volver a recomendados/ })).toHaveAttribute('href', '/recomendaciones?compare=8&maxPrice=30000000')
  expect(screen.getByText('1 vehículo seleccionado')).toBeVisible()
})

it('does not show a comparison when either existing calculator request fails; retries current data', async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path.endsWith('/8/costos')) throw new HttpError(503, null)
    return respond(path)
  })
  mount()
  await screen.findByRole('alert')
  expect(screen.queryByRole('region', { name: 'Comparación de vehículos' })).not.toBeInTheDocument()
  vi.mocked(apiFetch).mockImplementation(async (path) => respond(path))
  await userEvent.click(screen.getByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByRole('region', { name: 'Comparación de vehículos' })).toBeVisible()
})

it('requires correction when an ID no longer belongs to current recommendations', async () => {
  mount('compare=7,99')
  expect(await screen.findByText(/Algún vehículo ya no está disponible/)).toHaveAttribute('role', 'status')
  expect(screen.queryByRole('region', { name: 'Comparación de vehículos' })).not.toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(1)
})

it('ignores a late comparison response after TC-25 removal', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(apiFetch).mockImplementation(async (path) => path.endsWith('/7/costos')
    ? new Promise((done) => { resolve = done }) : respond(path))
  const mounted = mount()
  await waitFor(() => expect(resolve).toBeDefined())
  mounted.unmount()
  mount('compare=8')
  await act(async () => { resolve(entry().costs) })
  expect(screen.queryByRole('region', { name: 'Comparación de vehículos' })).not.toBeInTheDocument()
})
