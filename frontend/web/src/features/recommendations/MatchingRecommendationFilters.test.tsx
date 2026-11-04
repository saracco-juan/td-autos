import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch } from '../../lib/http'
import type { Recommendation } from './matching'
import MatchingRecommendationsPage from './MatchingRecommendationsPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))
const result = (id: number): Recommendation => ({
  listing_id: id, score: 70 + id, components: { usage: 100, body: 100, priority: 80, comfort: 60 },
  published_price: id * 5000, published_currency: 'USD', price_ars: id * 5000000, price_usd: id * 5000,
  budget_excess_percent: 0, budget_penalty: 0, warnings: [],
  vehicle: { marca: 'Toyota', modelo: 'Auto', version: String(id), anio: 2020, kilometraje: 60000,
    transmision: 'automatica', combustible: 'nafta', ubicacion: 'CABA', carroceria: 'Sedán', image_url: null },
  dealer: { id: 1, nombre: 'Concesionaria', provincia: 'CABA' },
})
const results = Array.from({ length: 10 }, (_, i) => result(10 - i))
const renderPage = (entry = '/recomendados') => render(
  <MemoryRouter initialEntries={[entry]}><MatchingRecommendationsPage /></MemoryRouter>,
)
// HU06: the page also requests the portal models; these tests only care about the dealers endpoint.
const dealers = { status: 'ready', results, exchange_rate: {
  quote: { sell: 1000, source: 'Fixture', updated_at: '2026-10-26T10:00:00Z' }, stale: false, warning: null,
} }
const dealerCalls = () => vi.mocked(apiFetch).mock.calls.filter(([path]) => path === '/api/recomendaciones').length
beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockImplementation(async (path) => (path === '/api/recomendaciones/modelos'
    ? { status: 'ready', modelos: [], fuente_precios: null } : dealers) as never)
})

it('HU07 TC-21 applies all criteria to the complete set before paging, retaining matching and ARS prices', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Mostrando 10 vehículos')
  await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
  await user.click(screen.getByText('FILTROS'))
  await user.type(screen.getByLabelText('Precio máximo (ARS)'), '5000000')
  await user.type(screen.getByLabelText('Año desde'), '2020')
  await user.type(screen.getByLabelText('Kilometraje máximo'), '60000')
  await user.selectOptions(screen.getByLabelText('Transmisión'), 'automatica')
  expect(screen.getByText('Mostrando 10 vehículos')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'APLICAR' }))
  expect(screen.getByText('Mostrando 1 vehículo')).toBeInTheDocument()
  const card = screen.getByRole('listitem', { name: 'Toyota Auto 1 2020' })
  expect(within(card).getByText('71% de compatibilidad')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Página siguiente' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Quitar Hasta $ 5.000.000' }))
  expect(screen.getByText('Mostrando 10 vehículos')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')[0]).toHaveAccessibleName('Toyota Auto 10 2020')
  expect(dealerCalls()).toBe(1)
  expect(apiFetch).toHaveBeenCalledWith('/api/recomendaciones')
})

it('HU07 TC-22 keeps filters and diagnosis intact on empty matches and clears immediately', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Mostrando 10 vehículos')
  await user.click(screen.getByText('FILTROS'))
  await user.selectOptions(screen.getByLabelText('Transmisión'), 'manual')
  await user.click(screen.getByRole('button', { name: 'APLICAR' }))
  expect(screen.getByText('No encontramos vehículos que cumplan estos filtros.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Quitar Manual' })).toBeVisible()
  expect(screen.queryByRole('list', { name: 'Recomendaciones' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'LIMPIAR FILTROS' }))
  expect(screen.getByText('Mostrando 10 vehículos')).toBeInTheDocument()
  expect(dealerCalls()).toBe(1)
})

it('HU07 restores applied filters after real router navigation and Back, without adding a HU09 screen', async () => {
  function Return() {
    const navigate = useNavigate()
    return <button onClick={() => navigate(-1)}>VOLVER</button>
  }
  render(<MemoryRouter initialEntries={['/recomendados']}><Routes>
    <Route path="/recomendados" element={<><MatchingRecommendationsPage /><Link to="/ficha-prueba">Abrir ficha de prueba</Link></>} />
    <Route path="/ficha-prueba" element={<Return />} />
  </Routes></MemoryRouter>)
  await screen.findByText('Mostrando 10 vehículos')
  await userEvent.click(screen.getByText('FILTROS'))
  await userEvent.type(screen.getByLabelText('Precio máximo (ARS)'), '5000000')
  await userEvent.click(screen.getByRole('button', { name: 'APLICAR' }))
  await userEvent.click(screen.getByRole('link', { name: 'Abrir ficha de prueba' }))
  await userEvent.click(screen.getByRole('button', { name: 'VOLVER' }))
  expect(await screen.findByText('Mostrando 1 vehículo')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Quitar Hasta $ 5.000.000' })).toBeVisible()
  await userEvent.click(screen.getByText('FILTROS'))
  expect(screen.getByLabelText('Precio máximo (ARS)')).toHaveValue(5000000)
})

it('HU07 ignores invalid filter URL values rather than hiding recommendations', async () => {
  renderPage('/recomendados?maxPrice=oops&minYear=-1&maxKilometers=1.5&transmission=invalid')
  expect(await screen.findByText('Mostrando 10 vehículos')).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument()
})

it('HU07 opens the filters as a side panel next to the results, not inside the toolbar', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Mostrando 10 vehículos')
  const toolbar = screen.getByRole('toolbar', { name: 'Filtros y comparación' })
  const toggle = within(toolbar).getByRole('button', { name: 'FILTROS' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('complementary', { name: 'Filtros de recomendaciones' })).not.toBeInTheDocument()
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const panel = screen.getByRole('complementary', { name: 'Filtros de recomendaciones' })
  expect(panel).toBeVisible()
  expect(toolbar).not.toContainElement(panel)
  expect(panel.parentElement).toContainElement(screen.getByRole('region', { name: 'Resultados' }))
  await user.click(toggle)
  expect(screen.queryByRole('complementary', { name: 'Filtros de recomendaciones' })).not.toBeInTheDocument()
})

it('HU07 keeps the applied chips in the toolbar and closes the side panel on APLICAR', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Mostrando 10 vehículos')
  const toolbar = screen.getByRole('toolbar', { name: 'Filtros y comparación' })
  await user.click(within(toolbar).getByRole('button', { name: 'FILTROS' }))
  await user.selectOptions(screen.getByLabelText('Transmisión'), 'automatica')
  await user.click(screen.getByRole('button', { name: 'APLICAR' }))
  expect(screen.queryByRole('complementary', { name: 'Filtros de recomendaciones' })).not.toBeInTheDocument()
  expect(within(toolbar).getByRole('button', { name: 'Quitar Automática' })).toBeVisible()
  expect(within(toolbar).getByRole('button', { name: 'FILTROS' })).toHaveFocus()
})
