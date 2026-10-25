import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch, HttpError, NetworkError } from '../../lib/http'
import RecommendationsPage from './MatchingRecommendationsPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))

const result = (id = 1) => ({
  listing_id: id, score: 90.25, components: { usage: 100, body: 100, priority: 100, comfort: 60 },
  published_price: 20600000, published_currency: 'ARS', price_ars: 20600000, price_usd: 20000,
  budget_excess_percent: 3, budget_penalty: 6, warnings: ['budget_exceeded', 'body_mismatch'],
  vehicle: { id, marca: 'Toyota', modelo: 'Corolla', version: `XEI ${id}`, anio: 2021, kilometraje: 62000,
    ubicacion: 'CABA', plazas: 5, carroceria: 'Sedán', transmision: 'automatica', combustible: 'nafta',
    motor: '1.8', turbo: false, potencia: 140, potencia_unidad: 'CV', consumo_urbano: 8, consumo_ruta: 6,
    android_auto_apple_carplay: true, frenos_abs: true, image_url: null },
  dealer: { id: 1, nombre: 'Autos del Sur', provincia: 'CABA' },
})
const ready = () => ({ status: 'ready', results: [result()], exchange_rate: {
  quote: { sell: 1030, source: 'DolarAPI', updated_at: '2026-10-20T12:00:00Z' }, stale: false, warning: null,
} })
const renderPage = () => render(<MemoryRouter><RecommendationsPage /></MemoryRouter>)

beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockImplementation(async (path) => path === '/api/recomendaciones'
    ? ready() : { publicaciones: [], fuentes: [], meta: { total: 0, page: 1, last_page: 1 } })
})

it('HU05 replaces search with saved-diagnosis matching and preserves API order', async () => {
  renderPage()
  expect(await screen.findByText('90,3% de compatibilidad')).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledWith('/api/recomendaciones')
  expect(apiFetch).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(screen.getByText('Mostrando 1 vehículo')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'AJUSTAR DIAGNÓSTICO' })).toHaveAttribute('href', '/diagnostico')
  const card = screen.getByRole('listitem', { name: 'Toyota Corolla XEI 1 2021' })
  expect(within(card).getByText(/Publicado:.*20.600.000/)).toBeInTheDocument()
  expect(within(card).getByText(/Equivalente:.*20.000/)).toBeInTheDocument()
  expect(within(card).getByText(/Autos del Sur/)).toBeInTheDocument()
  expect(within(card).getByText(/Supera tu presupuesto en 3/)).toBeInTheDocument()
  expect(within(card).getByText(/No coincide con la carrocería/)).toBeInTheDocument()
  await userEvent.click(within(card).getByText('Ver atributos y motivos'))
  expect(within(card).getByText(/Uso: 100.*Prioridad: 100/)).toBeVisible()
  expect(within(card).getByText(/5 plazas/)).toBeVisible()
  expect(within(card).getByText(/Seguridad: Frenos ABS/)).toBeVisible()
  expect(within(card).getByText(/Confort: Android Auto o Apple CarPlay/)).toBeVisible()
  expect(screen.getByText(/DolarAPI.*1.030.*20\/10\/2026/)).toBeInTheDocument()
})

it('paginates the backend top ten as nine plus one without sorting or requesting more', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...ready(), results: Array.from({ length: 10 }, (_, i) => result(10 - i)) })
  renderPage()
  expect(await screen.findByText('Mostrando 10 vehículos')).toBeInTheDocument()
  const cards = () => within(screen.getByRole('list', { name: 'Recomendaciones' })).getAllByRole('listitem')
  expect(cards()).toHaveLength(9)
  expect(cards()[0]).toHaveAccessibleName('Toyota Corolla XEI 10 2021')
  await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  expect(cards()).toHaveLength(1)
  expect(cards()[0]).toHaveAccessibleName('Toyota Corolla XEI 1 2021')
  expect(screen.getByText('Mostrando 10 vehículos')).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(1)
})

it.each([
  ['diagnosis_incomplete', 'Completá tu diagnóstico para ver recomendaciones.'],
  ['resale_pending', 'Las recomendaciones por reventa todavía no están disponibles.'],
  ['ready', 'No encontramos vehículos que coincidan con tu diagnóstico.'],
])('explains %s without inventing results', async (status, message) => {
  vi.mocked(apiFetch).mockResolvedValue({ status, results: [], exchange_rate: null })
  renderPage()
  expect(await screen.findByText(message)).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'AJUSTAR DIAGNÓSTICO' })).toBeInTheDocument()
})

it.each([false, true])('explains unavailable/stale quotes (stale=%s)', async (stale) => {
  const response = ready()
  vi.mocked(apiFetch).mockResolvedValue({ ...response, results: [{ ...result(), price_usd: null }],
    exchange_rate: { ...response.exchange_rate, stale, quote: stale ? response.exchange_rate.quote : null } })
  renderPage()
  expect(await screen.findByText(stale ? /Última cotización disponible/ : /Sin cotización disponible/)).toBeInTheDocument()
  if (!stale) expect(screen.getByText('Equivalente en USD no disponible.')).toBeInTheDocument()
  expect(screen.getByText(/Publicado:/)).toBeInTheDocument()
})

it('HU05 explains missing resale without inventing a zero or hiding partial scores below70', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...ready(), results: [{ ...result(), score: 62.5,
    components: { usage: 64, body: 100, priority: null, comfort: 20 }, warnings: ['resale_unavailable'],
  }] })
  renderPage()
  expect(await screen.findByText('62,5% de compatibilidad')).toBeInTheDocument()
  expect(screen.getByText(/Sin estimación de reventa.*10 puntos/)).toBeVisible()
  await userEvent.click(screen.getByText('Ver atributos y motivos'))
  expect(screen.getByText(/Prioridad: no disponible/)).toBeVisible()
})

it('HU05 shows dated resale sources and retained stale evidence', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...ready(), results: [{ ...result(), warnings: ['resale_stale'],
    resale: { activity_score: 100, retention_score: 80, source_date: '2026-10-19', window_start: '2026-04', window_end: '2026-09', stale: true },
  }] })
  renderPage()
  expect(await screen.findByText(/Reventa calculada con la última evidencia/)).toBeVisible()
  await userEvent.click(screen.getByText('Ver atributos y motivos'))
  expect(screen.getByText(/actividad DNRPA 2026-04 a 2026-09.*retención ACARA al 2026-10-19/)).toBeVisible()
  expect(screen.getByText(/no precios futuros garantizados/)).toBeVisible()
})

it('explains annualized estimates separately from observed year prices', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...ready(), results: [{ ...result(),
    resale: { activity_score: 80, retention_score: 75.5, source_date: '2026-10-19',
      window_start: '2026-04', window_end: '2026-09', stale: false,
      estimate: { method: 'annualized', horizon_years: 3, annual_depreciation_percent: 8.9, years_used: [2017, 2018, 2019] } },
  }] })
  renderPage()
  await screen.findByRole('list')
  await userEvent.click(screen.getByText('Ver atributos y motivos'))
  expect(screen.getByText(/Depreciación anual estimada: 8,9%.*2017, 2018, 2019/)).toBeVisible()
  expect(screen.getByText(/Retención estimada a 3 años: 75,5/)).toBeVisible()
})

it('shows grouped uncertainty and raw appreciation separately from the capped score', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...ready(), results: [{ ...result(),
    resale: { activity_score: 80, retention_score: 100, source_date: '2026-10-19',
      window_start: '2026-04', window_end: '2026-09', stale: false,
      estimate: { method: 'annualized', horizon_years: 3, annual_depreciation_percent: -10,
        years_used: [2023, 2025], retained_percent: 133.1, reference_count: 2, retention_range: [130, 136] } },
  }] })
  renderPage()
  await screen.findByRole('list')
  await userEvent.click(screen.getByText('Ver atributos y motivos'))
  expect(screen.getByText(/Retención estimada a 3 años: 133,1%/)).toBeVisible()
  expect(screen.getByText(/Estimación por grupo: 2 referencias compatibles.*130.*136/)).toBeVisible()
})

it.each([new NetworkError(new Error()), new HttpError(500, null)])('retries failures without showing stale results', async (error) => {
  vi.mocked(apiFetch).mockRejectedValueOnce(error).mockResolvedValueOnce(ready())
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByRole('list')).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(2)
})

it('loads only the results area and recalculates when the page is revisited', async () => {
  vi.mocked(apiFetch).mockReturnValueOnce(new Promise(() => {}))
  const first = renderPage()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
  first.unmount()
  renderPage()
  expect(await screen.findByRole('list')).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(2)
})

it('keeps a USD publication distinct from its ARS equivalent and shows its actual photo', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...ready(), results: [{ ...result(), published_price: 20000,
    published_currency: 'USD', vehicle: { ...result().vehicle, image_url: '/demo/corolla.webp' } }] })
  renderPage()
  expect(await screen.findByText('Publicado: US$ 20.000')).toBeInTheDocument()
  expect(screen.getByText('Equivalente: $ 20.600.000')).toBeInTheDocument()
  expect(screen.getByRole('img')).toHaveAttribute('src', '/demo/corolla.webp')
})

it('identifies inferred model families as approximate rather than exact', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...ready(), results: [{ ...result(),
    resale: { activity_score: 80, retention_score: 75, source_date: '2026-10-19',
      window_start: '2026-04', window_end: '2026-09', stale: false,
      model_match: { approximate: true, listing_model: 'Example', reference_model: 'Example Extended' } },
  }] })
  renderPage()
  await screen.findByRole('list')
  await userEvent.click(screen.getByText('Ver atributos y motivos'))
  expect(screen.getByText(/Referencia aproximada.*Example Extended.*Example.*No confirma/)).toBeVisible()
})
