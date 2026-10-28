import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch, HttpError, NetworkError } from '../../lib/http'
import type { Recommendation } from './matching'
import MatchingRecommendationsPage from './MatchingRecommendationsPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))

const DEALERS = '/api/recomendaciones'
const PORTALS = '/api/recomendaciones/modelos'
const vehicle = (id: number): Recommendation => ({
  listing_id: id, score: 80, components: { usage: 100, body: 100, priority: 80, comfort: 60 },
  published_price: 20600000, published_currency: 'ARS', price_ars: 20600000, price_usd: null,
  budget_excess_percent: 0, budget_penalty: 0, warnings: [],
  vehicle: { marca: 'Toyota', modelo: 'Corolla', version: String(id), anio: 2021, kilometraje: 62000,
    transmision: 'automatica', combustible: 'nafta', ubicacion: 'CABA', carroceria: 'Sedán', image_url: null },
  dealer: { id: 1, nombre: 'Autos del Sur', provincia: 'CABA' },
})
const dealers = (results = [vehicle(1)]) => ({ status: 'ready', results, exchange_rate: null })
const model = (id: number) => ({
  id, marca: 'TOYOTA', modelo: `Etios ${id}`, carroceria: 'Hatchback', anios: { desde: 2017, hasta: 2025 },
  precio: { desde_ars: 24662900, hasta_ars: 32670000, anio_referencia: 2025 }, motivos: ['Consumo bajo'],
  filtros: ['Hatchback'], links: [{ portal: 'mercadolibre', nombre: 'Mercado Libre', url: 'https://ml.example/x' }],
})
const portals = (count = 2) => ({ status: 'ready', modelos: Array.from({ length: count }, (_, i) => model(i + 1)),
  fuente_precios: { nombre: 'Guía de precios ACARA', fecha: '2026-10-19' } })
const respond = (routes: { dealers?: () => unknown; portals?: () => unknown }) =>
  vi.mocked(apiFetch).mockImplementation(async (path) => (path === PORTALS
    ? (routes.portals ?? portals)() : (routes.dealers ?? dealers)()) as never)
const calls = (path: string) => vi.mocked(apiFetch).mock.calls.filter(([called]) => called === path).length
const renderPage = () => render(<MemoryRouter><MatchingRecommendationsPage /></MemoryRouter>)
const tab = (name: string | RegExp) => screen.getByRole('tab', { name })
const COROLLA = 'Toyota Corolla 1 2021'

beforeEach(() => { vi.mocked(apiFetch).mockReset(); respond({}) })

it('HU06 requests both endpoints in parallel and opens on the dealers tab', async () => {
  renderPage()
  expect(await screen.findByRole('listitem', { name: COROLLA })).toBeInTheDocument()
  expect(calls(DEALERS)).toBe(1)
  expect(calls(PORTALS)).toBe(1)
  expect(tab('Concesionarias')).toHaveAttribute('aria-selected', 'true')
  expect(await screen.findByRole('tab', { name: 'Otros portales · 2 modelos' })).toHaveAttribute('aria-selected', 'false')
})

it('HU06 labels the portals tab in singular for a single model and without a count while loading', async () => {
  respond({ portals: () => portals(1) })
  renderPage()
  expect(tab('Otros portales')).toBeInTheDocument()
  expect(await screen.findByRole('tab', { name: 'Otros portales · 1 modelo' })).toBeInTheDocument()
})

it('HU06 labels a ready but empty portals list with a zero count', async () => {
  respond({ portals: () => portals(0) })
  renderPage()
  await waitFor(() => expect(tab('Otros portales · 0 modelos')).toBeInTheDocument())
})

it('HU06 keeps the filters and the comparison controls on the dealers tab only', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('listitem', { name: COROLLA })
  expect(screen.getByText('FILTROS')).toBeVisible()
  expect(screen.getByRole('region', { name: 'Selección para comparar' })).toBeVisible()
  await user.click(await screen.findByRole('tab', { name: /Otros portales/ }))
  expect(await screen.findByRole('listitem', { name: 'Toyota Etios 1' })).toBeVisible()
  expect(screen.queryByText('FILTROS')).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Selección para comparar' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument()
  expect(screen.getByText('2 modelos recomendados')).toBeVisible()
  expect(screen.getByRole('link', { name: 'AJUSTAR DIAGNÓSTICO' })).toBeVisible()
  await user.click(tab('Concesionarias'))
  expect(screen.getByText('FILTROS')).toBeVisible()
  expect(screen.getByText('Mostrando 1 vehículo')).toBeVisible()
})

it('HU06 opens on the portals tab when the first dealers load is empty, and never switches again', async () => {
  const user = userEvent.setup()
  let dealersResult = dealers([])
  respond({ dealers: () => dealersResult })
  renderPage()
  expect(await screen.findByRole('listitem', { name: 'Toyota Etios 1' })).toBeVisible()
  expect(tab(/Otros portales/)).toHaveAttribute('aria-selected', 'true')
  await user.click(tab('Concesionarias'))
  expect(screen.getByText('No encontramos vehículos que coincidan con tu diagnóstico.')).toBeVisible()
  dealersResult = dealers()
  expect(tab('Concesionarias')).toHaveAttribute('aria-selected', 'true')
})

it('HU06 does not pull the user away from a tab chosen while the dealers list was loading', async () => {
  const user = userEvent.setup()
  let release: (value: unknown) => void = () => {}
  respond({ dealers: () => new Promise((resolve) => { release = resolve }) })
  renderPage()
  await user.click(await screen.findByRole('tab', { name: /Otros portales/ }))
  await user.click(tab('Concesionarias'))
  release(dealers([]))
  expect(await screen.findByText('No encontramos vehículos que coincidan con tu diagnóstico.')).toBeVisible()
  expect(tab('Concesionarias')).toHaveAttribute('aria-selected', 'true')
})

it('HU06 keeps the dealers tab working when the portals request fails and retries only that endpoint', async () => {
  const user = userEvent.setup()
  let failing = true
  respond({ portals: () => {
    if (failing) throw new NetworkError(new Error())
    return portals()
  } })
  renderPage()
  expect(await screen.findByRole('listitem', { name: COROLLA })).toBeVisible()
  await user.click(tab('Otros portales'))
  expect(await screen.findByRole('alert')).toBeVisible()
  failing = false
  await user.click(screen.getByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByRole('listitem', { name: 'Toyota Etios 1' })).toBeVisible()
  expect(calls(PORTALS)).toBe(2)
  expect(calls(DEALERS)).toBe(1)
  expect(tab('Otros portales · 2 modelos')).toBeInTheDocument()
})

it('HU06 shows a server error in the portals tab without touching the dealers results', async () => {
  const user = userEvent.setup()
  respond({ portals: () => { throw new HttpError(500, null) } })
  renderPage()
  await screen.findByRole('listitem', { name: COROLLA })
  await user.click(tab('Otros portales'))
  expect(await screen.findByText('Algo salió mal')).toBeVisible()
  await user.click(tab('Concesionarias'))
  expect(screen.getByRole('listitem', { name: COROLLA })).toBeVisible()
})

it('HU06 shows a local loader in the portals panel while its request is pending', async () => {
  const user = userEvent.setup()
  respond({ portals: () => new Promise(() => {}) })
  renderPage()
  await screen.findByRole('listitem', { name: COROLLA })
  await user.click(tab('Otros portales'))
  expect(within(screen.getByRole('tabpanel')).getByRole('status')).toHaveTextContent('Cargando')
  expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
})

it('HU06 explains an incomplete diagnosis in the portals tab with the link to adjust it', async () => {
  const user = userEvent.setup()
  respond({ portals: () => ({ status: 'diagnosis_incomplete', modelos: [], fuente_precios: null }) })
  renderPage()
  await screen.findByRole('listitem', { name: COROLLA })
  await user.click(tab('Otros portales'))
  expect(await screen.findByText('Completá tu diagnóstico para ver recomendaciones.')).toBeVisible()
  expect(screen.getByRole('link', { name: 'AJUSTAR DIAGNÓSTICO' })).toHaveAttribute('href', '/diagnostico')
})

it('HU06 shows the count of the active tab as the page subtitle, outside the panel', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('listitem', { name: COROLLA })
  const subtitle = screen.getByText('Mostrando 1 vehículo')
  expect(within(screen.getByRole('tabpanel')).queryByText('Mostrando 1 vehículo')).not.toBeInTheDocument()
  expect(subtitle.closest('[role="tabpanel"]')).toBeNull()
  await user.click(await screen.findByRole('tab', { name: /Otros portales/ }))
  expect(screen.getByText('2 modelos recomendados')).toBeVisible()
  expect(screen.queryByText('Mostrando 1 vehículo')).not.toBeInTheDocument()
})

it('HU06 words the portals subtitle in singular and leaves it out while loading or on error', async () => {
  const user = userEvent.setup()
  respond({ portals: () => portals(1) })
  const { unmount } = renderPage()
  await user.click(await screen.findByRole('tab', { name: /Otros portales/ }))
  expect(await screen.findByText('1 modelo recomendado')).toBeVisible()
  unmount()
  respond({ portals: () => new Promise(() => {}) })
  renderPage()
  await screen.findByRole('listitem', { name: COROLLA })
  await user.click(tab('Otros portales'))
  expect(screen.queryByText(/modelos? recomendados?$/)).not.toBeInTheDocument()
})

it('HU06 leaves the dealers subtitle out while loading and when the request fails', async () => {
  respond({ dealers: () => { throw new HttpError(500, null) } })
  renderPage()
  expect(await screen.findByText('Algo salió mal')).toBeVisible()
  expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument()
})

it('HU06 groups the filters and the comparison controls in one toolbar inside the dealers panel', async () => {
  renderPage()
  await screen.findByRole('listitem', { name: COROLLA })
  const toolbar = within(screen.getByRole('tabpanel')).getByRole('toolbar', { name: 'Filtros y comparación' })
  expect(within(toolbar).getByText('FILTROS')).toBeVisible()
  expect(within(toolbar).getByRole('region', { name: 'Selección para comparar' })).toBeVisible()
  expect(within(toolbar).getByRole('button', { name: 'COMPARAR' })).toBeVisible()
})

it('HU06 renders compact tabs, not full-width boxes, and keeps arrow-key navigation', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('listitem', { name: COROLLA })
  expect(screen.getByRole('tablist')).toHaveAttribute('data-variant', 'underline')
  tab('Concesionarias').focus()
  await user.keyboard('{ArrowRight}')
  expect(tab(/Otros portales/)).toHaveAttribute('aria-selected', 'true')
})
