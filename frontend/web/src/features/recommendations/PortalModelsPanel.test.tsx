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

it('HU06 shows the intro, one card per model and the dated price source', () => {
  renderPanel(ready())
  expect(screen.getByText('Estos modelos encajan con tu diagnóstico. Te llevamos al portal con la búsqueda ya armada.')).toBeVisible()
  const list = screen.getByRole('list', { name: 'Modelos en otros portales' })
  expect(within(list).getAllByRole('listitem', { name: /Toyota Etios/ })).toHaveLength(2)
  expect(screen.getByText('Precios de referencia: Guía de precios ACARA, 19/10/2026')).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('HU06 card shows the title, years pill, price block, reasons and filter chips and the no-photo placeholder', () => {
  renderPanel(ready())
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  expect(within(card).getByText('Años 2017–2025')).toBeVisible()
  expect(within(card).getByText('Precio de referencia')).toBeVisible()
  expect(within(card).getByText('$ 24.662.900 – $ 32.670.000')).toBeVisible()
  expect(within(card).getByText('modelos 2025')).toBeVisible()
  const reasons = within(card).getByRole('list', { name: 'Motivos' })
  expect(within(reasons).getAllByRole('listitem').map((item) => item.textContent))
    .toEqual(['Consumo bajo', 'Apto para ciudad', '5 plazas'])
  expect(within(card).getByText('Filtros que aplicamos en Mercado Libre')).toBeVisible()
  const chips = within(card).getByRole('list', { name: 'Filtros que aplicamos en Mercado Libre' })
  expect(within(chips).getAllByRole('listitem').map((item) => item.textContent))
    .toEqual(['Hatchback', '2017–2025', 'Hasta $ 33.000.000'])
  expect(within(card).queryByRole('img')).not.toBeInTheDocument()
  expect(within(card).getByText('Sin fotos')).toBeVisible()
  expect(card.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(4)
})

it('HU06 shows the model photo with its alt, lazy loading and a credit link to the file page', () => {
  renderPanel(ready({ modelos: [model(1, { imagen: photo })] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  const image = within(card).getByRole('img', { name: 'Toyota Etios 1' })
  expect(image).toHaveAttribute('src', photo.url)
  expect(image).toHaveAttribute('loading', 'lazy')
  expect(within(card).queryByText('Sin fotos')).not.toBeInTheDocument()
  const credit = within(card).getByRole('link', { name: 'Foto: Maxi-Napo-99 · CC BY 4.0 · Wikimedia Commons' })
  expect(credit).toHaveAttribute('href', photo.pagina)
  expect(credit).toHaveAttribute('target', '_blank')
  expect(credit).toHaveAttribute('rel', 'noopener noreferrer')
})

it('HU06 falls back to the placeholder, without the credit, when the photo fails to load', () => {
  renderPanel(ready({ modelos: [model(1, { imagen: photo })] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })

  fireEvent.error(within(card).getByRole('img', { name: 'Toyota Etios 1' }))

  expect(within(card).queryByRole('img')).not.toBeInTheDocument()
  expect(within(card).getByText('Sin fotos')).toBeVisible()
  expect(within(card).queryByText(/Wikimedia Commons/)).not.toBeInTheDocument()
  expect(within(card).getAllByRole('link')).toHaveLength(2)
})

it('HU06 gives both portal links the same class so they share width and height', () => {
  renderPanel(ready({ modelos: [model(1)] }))
  const [ml, kavak] = screen.getAllByRole('link')
  expect(ml.className).toBe(kavak.className)
})

it('HU06 labels a single model year as "Año"', () => {
  renderPanel(ready({ modelos: [model(1, { anios: { desde: 2020, hasta: 2020 } })] }))
  expect(screen.getByText('Año 2020')).toBeVisible()
})

it('HU06 opens each portal in a new tab with a safe real link and the Kavak note', () => {
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
  expect(within(card).getByText('Las publicaciones y los precios son del portal. En Kavak aplicamos solo la transmisión.')).toBeVisible()
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
