import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch, HttpError, NetworkError } from '../../../lib/http'
import RecommendationsPage from '../../../features/recommendations/pages/MatchingRecommendationsPage'

vi.mock('../../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))

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

// HU06: the page also requests the portal models; these tests only care about the dealers endpoint.
const NO_PORTALS = { status: 'ready', modelos: [], fuente_precios: null }
const mockDealers = (value: unknown) => vi.mocked(apiFetch).mockImplementation(async (path) =>
  (path === '/api/recomendaciones' ? value : path === '/api/diagnostico'
    ? { diagnostico: { prioridad: 'reventa' }, carrocerias: [] } : NO_PORTALS) as never)
const dealerCalls = () => vi.mocked(apiFetch).mock.calls.filter(([path]) => path === '/api/recomendaciones').length

beforeEach(() => {
  vi.mocked(apiFetch).mockReset()
  mockDealers(ready())
})

it('HU05 replaces search with saved-diagnosis matching and preserves API order', async () => {
  renderPage()
  expect(await screen.findByText('90,3% de compatibilidad')).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledWith('/api/recomendaciones')
  expect(dealerCalls()).toBe(1)
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Concesionarias', expect.stringMatching(/^Otros portales/)])
  expect(screen.getByText('Mostrando 1 vehículo')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'AJUSTAR DIAGNÓSTICO' })).toHaveAttribute('href', '/diagnostico')
  const card = screen.getByRole('listitem', { name: 'Toyota Corolla XEI 1 2021' })
  expect(within(card).getByText(/Publicado:.*20.600.000/)).toBeInTheDocument()
  expect(within(card).getByText(/Equivalente:.*20.000/)).toBeInTheDocument()
  expect(within(card).getByText(/Autos del Sur/)).toBeInTheDocument()
  expect(within(card).getByText(/Supera tu presupuesto en 3/)).toBeInTheDocument()
  expect(within(card).getByText(/No coincide con la carrocería/)).toBeInTheDocument()
  await userEvent.click(within(card).getByRole('button', { name: /Por qué recomendamos/ }))
  expect(within(card).getByRole('tooltip')).toHaveTextContent('Uso100/100')
  expect(within(card).queryByText(/5 plazas/)).not.toBeInTheDocument()
  const quote = screen.getByText(/Cotización USD:.*1.030/)
  expect(quote).toHaveTextContent('Actualizada: 20/10/2026')
})

it('paginates the backend top ten as nine plus one without sorting or requesting more', async () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
  const scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
  mockDealers({ ...ready(), results: Array.from({ length: 10 }, (_, i) => result(10 - i)) })
  try {
    renderPage()
    expect(await screen.findByText('Mostrando 10 vehículos')).toBeInTheDocument()
    const cards = () => within(screen.getByRole('list', { name: 'Recomendaciones' })).getAllByRole('listitem')
    expect(cards()).toHaveLength(9)
    expect(cards()[0]).toHaveAccessibleName('Toyota Corolla XEI 10 2021')
    const nextPage = screen.getByRole('button', { name: 'Página siguiente' })
    await userEvent.click(nextPage)
    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toHaveAccessibleName('Toyota Corolla XEI 1 2021')
    expect(screen.getByText('Mostrando 10 vehículos')).toBeInTheDocument()
    expect(screen.queryByText('Mostrar')).not.toBeInTheDocument()
    expect(dealerCalls()).toBe(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    expect(nextPage).toHaveFocus()
  } finally {
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScrollIntoView })
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
    }
  }
})

it.each([
  ['diagnosis_incomplete', 'Completá tu diagnóstico para ver recomendaciones.'],
  ['resale_pending', 'Las recomendaciones por reventa todavía no están disponibles.'],
  ['ready', 'No encontramos vehículos que coincidan con tu diagnóstico.'],
])('explains %s without inventing results', async (status, message) => {
  mockDealers({ status, results: [], exchange_rate: null })
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: 'Concesionarias' }))
  expect(await screen.findByText(message)).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'AJUSTAR DIAGNÓSTICO' })).toBeInTheDocument()
})

it.each([false, true])('explains unavailable/stale quotes (stale=%s)', async (stale) => {
  const response = ready()
  mockDealers({ ...response, results: [{ ...result(), price_usd: null }],
    exchange_rate: { ...response.exchange_rate, stale, quote: stale ? response.exchange_rate.quote : null } })
  renderPage()
  expect(await screen.findByText(stale ? /Última cotización disponible/ : /Sin cotización disponible/)).toBeInTheDocument()
  if (!stale) expect(screen.getByText('Equivalente en USD no disponible.')).toBeInTheDocument()
  expect(screen.getByText(/Publicado:/)).toBeInTheDocument()
})

it('HU05 explains missing resale without inventing a zero or hiding partial scores below70', async () => {
  mockDealers({ ...ready(), results: [{ ...result(), score: 62.5,
    components: { usage: 64, body: 100, priority: null, comfort: 20 }, warnings: ['resale_unavailable'],
  }] })
  renderPage()
  expect(await screen.findByText('62,5% de compatibilidad')).toBeInTheDocument()
  expect(screen.getByText(/Sin estimación de reventa.*10 puntos/)).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: /Por qué recomendamos/ }))
  expect(screen.getByRole('tooltip')).toHaveTextContent('Buena reventaSin datos')
})







it.each([new NetworkError(new Error()), new HttpError(500, null)])('retries failures without showing stale results', async (error) => {
  let dealerAttempts = 0
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path !== '/api/recomendaciones') return NO_PORTALS as never
    if (dealerAttempts++ === 0) throw error
    return ready() as never
  })
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByRole('list')).toBeInTheDocument()
  expect(dealerCalls()).toBe(2)
})

it('loads only the results area and recalculates when the page is revisited', async () => {
  vi.mocked(apiFetch).mockReturnValueOnce(new Promise(() => {}))
  const first = renderPage()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
  first.unmount()
  renderPage()
  expect(await screen.findByRole('list')).toBeInTheDocument()
  expect(dealerCalls()).toBe(2)
})

it('keeps a USD publication distinct from its ARS equivalent and shows its actual photo', async () => {
  mockDealers({ ...ready(), results: [{ ...result(), published_price: 20000,
    published_currency: 'USD', vehicle: { ...result().vehicle, image_url: '/demo/corolla.webp' } }] })
  renderPage()
  expect(await screen.findByText('Publicado: USD 20.000')).toBeInTheDocument()
  expect(screen.getByText('Equivalente: $ 20.600.000')).toBeInTheDocument()
  expect(screen.getByRole('img')).toHaveAttribute('src', '/demo/corolla.webp')
})

it('leaves the cost estimate to the vehicle detail instead of the card', async () => {
  renderPage()
  const card = await screen.findByRole('listitem', { name: 'Toyota Corolla XEI 1 2021' })
  expect(within(card).getByRole('link', { name: 'VER FICHA' })).toHaveAttribute('href', '/vehiculos/1')
  expect(within(card).queryByRole('link', { name: 'CALCULAR COSTOS' })).not.toBeInTheDocument()
})



it('shows a neutral "Sin fotos" placeholder when the vehicle has no photo or the photo fails to load', async () => {
  mockDealers({ ...ready(), results: [result(1), { ...result(2), vehicle: { ...result(2).vehicle, image_url: '/missing.webp' } }] })
  renderPage()
  const first = await screen.findByRole('listitem', { name: 'Toyota Corolla XEI 1 2021' })
  expect(within(first).getByText('Sin fotos')).toBeVisible()
  expect(within(first).queryByRole('img', { name: /Foto de/ })).not.toBeInTheDocument()
  const second = screen.getByRole('listitem', { name: 'Toyota Corolla XEI 2 2021' })
  fireEvent.error(within(second).getByRole('img', { name: /Foto de/ }))
  expect(within(second).getByText('Sin fotos')).toBeVisible()
  expect(within(second).queryByRole('img', { name: /Foto de/ })).not.toBeInTheDocument()
})

it('keeps concise reasons in an optional info tip instead of expanding the card', async () => {
  renderPage()
  const card = await screen.findByRole('listitem', { name: 'Toyota Corolla XEI 1 2021' })
  expect(within(card).queryByText('Ver atributos y motivos')).not.toBeInTheDocument()
  expect(within(card).queryByRole('tooltip')).not.toBeInTheDocument()
  const info = within(card).getByRole('button', { name: /Por qué recomendamos/ })
  await userEvent.click(info)
  const tip = within(card).getByRole('tooltip')
  expect(tip).toHaveTextContent('Por qué se recomienda')
  expect(tip).toHaveTextContent('Buena reventa100/100')
  expect(tip).not.toHaveTextContent('Prioridad')
  expect(tip).toHaveTextContent('Confort60/100')
  expect(tip).toHaveTextContent('Presupuesto: −6 puntos')
  expect(tip).not.toHaveTextContent('Motor y capacidad')
  await userEvent.keyboard('{Escape}')
  expect(tip).not.toBeVisible()
  expect(info).toHaveFocus()
})


it('changes inventory photos without navigating and keeps body warnings in an info tip', async () => {
  const item = result()
  mockDealers({ ...ready(), results: [{ ...item, vehicle: { ...item.vehicle,
    image_url: '/one.jpg', image_urls: ['/one.jpg', '/two.jpg', '/three.jpg', '/four.jpg'],
  } }] })
  renderPage()
  const card = await screen.findByRole('listitem', { name: 'Toyota Corolla XEI 1 2021' })
  const photo = () => within(card).getByRole('img', { name: /Foto de Toyota/ })
  expect(photo()).toHaveAttribute('src', '/one.jpg')
  await userEvent.click(within(card).getByRole('button', { name: 'Foto siguiente' }))
  expect(photo()).toHaveAttribute('src', '/two.jpg')
  await userEvent.click(within(card).getByRole('button', { name: 'Ver foto 3 de 4' }))
  expect(photo()).toHaveAttribute('src', '/three.jpg')
  await userEvent.click(within(card).getByRole('button', { name: 'Foto siguiente' }))
  expect(photo()).toHaveAttribute('src', '/four.jpg')
  await userEvent.click(within(card).getByRole('button', { name: 'Foto siguiente' }))
  expect(photo()).toHaveAttribute('src', '/one.jpg')
  for (let step = 0; step < 12; step++) {
    await userEvent.click(within(card).getByRole('button', { name: 'Foto anterior' }))
    const expected = [4, 3, 2, 1][step % 4]
    expect(within(card).getByRole('button', { name: `Ver foto ${expected} de 4`, pressed: true })).toBeInTheDocument()
  }
  expect(within(card).getByText('No coincide con la carrocería elegida.')).not.toBeVisible()
  await userEvent.click(within(card).getByRole('button', { name: /Advertencia de carrocería/ }))
  expect(within(card).getByRole('tooltip')).toHaveTextContent('No coincide con la carrocería elegida.')
  await userEvent.keyboard('{Escape}')
  expect(within(card).queryByRole('tooltip')).not.toBeInTheDocument()
})

it('reserves the count line while loading, so the header does not move when the list arrives', () => {
  vi.mocked(apiFetch).mockReturnValue(new Promise(() => {}))
  renderPage()
  const countLine = screen.getByRole('heading', { level: 1 }).nextElementSibling
  expect(countLine?.tagName).toBe('P')
  expect(countLine).toHaveAttribute('aria-hidden', 'true')
})
