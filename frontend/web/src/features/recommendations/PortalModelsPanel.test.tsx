import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { PortalModel, PortalModelsResponse } from '@shared/portals/models'
import type { PortalModelsView } from './portalModels'
import PortalModelsPanel from './PortalModelsPanel'

const model = (id: number, overrides: Partial<PortalModel> = {}): PortalModel => ({
  id, marca: 'TOYOTA', modelo: `Etios ${id}`, carroceria: 'Hatchback',
  anios: { desde: 2017, hasta: 2025 },
  precio: { desde_ars: 24662900, hasta_ars: 32670000, anio_referencia: 2025 },
  motivos: ['Consumo bajo', 'Apto para ciudad', '5 plazas'],
  filtros: ['Hatchback', '2017–2025', 'Hasta $ 33.000.000'],
  links: [
    { portal: 'mercadolibre', nombre: 'Mercado Libre', url: 'https://autos.mercadolibre.com.ar/etios' },
    { portal: 'kavak', nombre: 'Kavak', url: 'https://www.kavak.com/ar/usado/toyota-etios' },
  ],
  imagen: null,
  ...overrides,
})
const photo = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Etios.jpg/500px-Etios.jpg',
  autor: 'Maxi-Napo-99', licencia: 'CC BY 4.0', pagina: 'https://commons.wikimedia.org/wiki/File:Etios.jpg',
}
const response = (overrides: Partial<PortalModelsResponse> = {}): PortalModelsResponse => ({
  status: 'ready', modelos: [model(1), model(2)], exchange_rate: null,
  fuente_precios: { nombre: 'Guía de precios ACARA', fecha: '2026-10-19' }, ...overrides,
})
const renderPanel = (view: PortalModelsView, onRetry = vi.fn()) =>
  render(<PortalModelsPanel view={view} onRetry={onRetry} />)
const ready = (overrides: Partial<PortalModelsResponse> = {}): PortalModelsView =>
  ({ status: 'ready', response: response(overrides) })

const NOTICE = 'Estos son modelos, no unidades en venta: la foto es ilustrativa. Elegí un portal y te llevamos a la búsqueda ya armada para que veas las unidades reales.'

it('HU06 shows the models-not-units message, one card per model and the dated price source', () => {
  renderPanel(ready())
  const notice = screen.getByText(NOTICE)
  expect(notice).toBeVisible()
  expect(notice.className).toMatch(/notice/)
  const list = screen.getByRole('list', { name: 'Modelos en otros portales' })
  expect(within(list).getAllByRole('listitem', { name: /Toyota Etios/ })).toHaveLength(2)
  expect(screen.getByText('Precios de referencia: Guía de precios ACARA, 19/10/2026')).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('HU06 renders nine models in one list with no pager', () => {
  renderPanel(ready({ modelos: Array.from({ length: 9 }, (_, i) => model(i + 1)) }))
  const list = screen.getByRole('list', { name: 'Modelos en otros portales' })
  expect(within(list).getAllByRole('listitem', { name: /Toyota Etios/ })).toHaveLength(9)
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})

it('HU06 card mirrors the dealers card: title, models line, no-photo placeholder, price block, body chip and actions', () => {
  renderPanel(ready())
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  expect(within(card).getByText('Toyota Etios 1')).toBeVisible()
  expect(within(card).getByText('Modelos 2017–2025')).toBeVisible()
  expect(within(card).getByText('$ 24.662.900 – $ 32.670.000')).toBeVisible()
  expect(within(card).getByText('Precio de referencia del modelo 2025')).toBeVisible()
  expect(within(card).getAllByText('Hatchback')[0]).toBeVisible()
  expect(within(card).queryByRole('img')).not.toBeInTheDocument()
  expect(within(card).getByText('Sin fotos')).toBeVisible()
  expect(within(card).queryByText('Foto ilustrativa')).not.toBeInTheDocument()
  expect(within(card).getAllByRole('link')).toHaveLength(2)
})

it('HU06 keeps reasons, filter chips and the Kavak note inside a "Ver motivos y filtros" disclosure', async () => {
  renderPanel(ready({ modelos: [model(1)] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  const summary = within(card).getByText('Ver motivos y filtros')
  const details = summary.closest('details') as HTMLDetailsElement
  expect(details.open).toBe(false)
  await userEvent.click(summary)
  expect(details.open).toBe(true)
  const reasons = within(details).getByRole('list', { name: 'Motivos' })
  expect(within(reasons).getAllByRole('listitem').map((item) => item.textContent))
    .toEqual(['Consumo bajo', 'Apto para ciudad', '5 plazas'])
  expect(within(details).getByText('Filtros que aplicamos en Mercado Libre')).toBeInTheDocument()
  const chips = within(details).getByRole('list', { name: 'Filtros que aplicamos en Mercado Libre' })
  expect(within(chips).getAllByRole('listitem').map((item) => item.textContent))
    .toEqual(['Hatchback', '2017–2025', 'Hasta $ 33.000.000'])
  expect(within(details).getByText('Las unidades y sus precios reales son del portal. En Kavak aplicamos solo la transmisión.')).toBeInTheDocument()
})

it('HU06 shows the model photo with its alt, lazy loading and the "Foto ilustrativa" pill, without a per-card credit', () => {
  renderPanel(ready({ modelos: [model(1, { imagen: photo })] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  const image = within(card).getByRole('img', { name: 'Toyota Etios 1' })
  expect(image).toHaveAttribute('src', photo.url)
  expect(image).toHaveAttribute('loading', 'lazy')
  expect(within(card).queryByText('Sin fotos')).not.toBeInTheDocument()
  expect(within(card).getByText('Foto ilustrativa')).toBeVisible()
  expect(within(card).queryByText(/Wikimedia Commons/)).not.toBeInTheDocument()
  expect(within(card).queryByText(/Maxi-Napo-99/)).not.toBeInTheDocument()
  expect(within(card).getAllByRole('link')).toHaveLength(2)
})

it('HU06 falls back to the placeholder, without the pill, when the photo fails to load', () => {
  renderPanel(ready({ modelos: [model(1, { imagen: photo })] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })

  fireEvent.error(within(card).getByRole('img', { name: 'Toyota Etios 1' }))

  expect(within(card).queryByRole('img')).not.toBeInTheDocument()
  expect(within(card).getByText('Sin fotos')).toBeVisible()
  expect(within(card).queryByText('Foto ilustrativa')).not.toBeInTheDocument()
  expect(within(card).getAllByRole('link')).toHaveLength(2)
})

it('HU06 credits the photos once, in a disclosure with a link per model that has a photo', async () => {
  const other = { ...photo, autor: 'Otro Autor', licencia: 'CC BY-SA 3.0', pagina: 'https://commons.wikimedia.org/wiki/File:Otro.jpg' }
  renderPanel(ready({ modelos: [model(1, { imagen: photo }), model(2), model(3, { imagen: other })] }))
  const summary = screen.getByText('Créditos de las fotos')
  const details = summary.closest('details') as HTMLDetailsElement
  expect(details.open).toBe(false)
  await userEvent.click(summary)
  expect(within(details).getByText(/Wikimedia Commons/)).toBeInTheDocument()
  const links = within(details).getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual([
    'Toyota Etios 1: Maxi-Napo-99 · CC BY 4.0', 'Toyota Etios 3: Otro Autor · CC BY-SA 3.0',
  ])
  expect(links[0]).toHaveAttribute('href', photo.pagina)
  expect(links[1]).toHaveAttribute('href', other.pagina)
  for (const link of links) {
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
  expect(within(details).queryByText(/Etios 2/)).not.toBeInTheDocument()
})

it('HU06 has no credits disclosure when no model has a photo', () => {
  renderPanel(ready())
  expect(screen.queryByText('Créditos de las fotos')).not.toBeInTheDocument()
})

it('HU06 gives both portal links the same class so they share width and height', () => {
  renderPanel(ready({ modelos: [model(1)] }))
  const [ml, kavak] = screen.getAllByRole('link')
  expect(ml.className).toBe(kavak.className)
})

it('HU06 labels a single model year as "Modelo"', () => {
  renderPanel(ready({ modelos: [model(1, { anios: { desde: 2020, hasta: 2020 } })] }))
  expect(screen.getByText('Modelo 2020')).toBeVisible()
})

it('HU06 omits the body chip when the model has no body type', () => {
  renderPanel(ready({ modelos: [model(1, { carroceria: null, filtros: [] })] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  expect(within(card).queryByText('Hatchback')).not.toBeInTheDocument()
})

it('HU06 opens each portal in a new tab with a safe real link', () => {
  renderPanel(ready({ modelos: [model(1)] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  const ml = within(card).getByRole('link', { name: 'VER EN MERCADO LIBRE: Toyota Etios 1 (se abre en una pestaña nueva)' })
  const kavak = within(card).getByRole('link', { name: 'VER EN KAVAK: Toyota Etios 1 (se abre en una pestaña nueva)' })
  expect(ml).toHaveTextContent('VER EN MERCADO LIBRE')
  expect(ml).toHaveAttribute('href', 'https://autos.mercadolibre.com.ar/etios')
  expect(kavak).toHaveAttribute('href', 'https://www.kavak.com/ar/usado/toyota-etios')
  for (const link of [ml, kavak]) {
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
})

it('HU06 shows one button per link the API returns', () => {
  renderPanel(ready({ modelos: [model(1, { links: [model(1).links[0]] })] }))
  expect(screen.getAllByRole('link')).toHaveLength(1)
})

it('HU06 repeats the exchange-rate notice of the dealers tab only when the API sends it', () => {
  const { unmount } = renderPanel(ready())
  expect(screen.queryByText(/Dólar oficial venta/)).not.toBeInTheDocument()
  unmount()
  renderPanel(ready({ exchange_rate: {
    quote: { sell: 1030, source: 'DolarAPI', updated_at: '2026-10-20T12:00:00Z' }, stale: true, warning: null,
  } }))
  expect(screen.getByText(/Dólar oficial venta · DolarAPI · \$ 1.030/)).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Última cotización disponible: no se pudo actualizar.')
})

it('HU06 explains an empty ready list with a filled info message', () => {
  renderPanel(ready({ modelos: [] }))
  expect(screen.getByRole('status')).toHaveTextContent('No encontramos modelos para tu diagnóstico.')
  expect(screen.getByText('Probá ajustando el presupuesto o la carrocería.')).toBeVisible()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

it('HU06 asks to complete the diagnosis with the dealers-tab copy', () => {
  renderPanel(ready({ status: 'diagnosis_incomplete', modelos: [], fuente_precios: null }))
  expect(screen.getByText('Completá tu diagnóstico para ver recomendaciones.')).toBeVisible()
  expect(screen.getByText('Ajustá el diagnóstico para buscar otras opciones.')).toBeVisible()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

it('HU06 shows a local loader while the models load', () => {
  renderPanel({ status: 'loading' })
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
})

it.each(['network', 'server'] as const)('HU06 shows the shared error (%s) and retries on demand', async (kind) => {
  const onRetry = vi.fn()
  renderPanel({ status: 'error', kind }, onRetry)
  expect(screen.getByRole('alert')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'REINTENTAR' }))
  expect(onRetry).toHaveBeenCalledTimes(1)
})
