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
  imagen_url: null,
  ...overrides,
})
const photo = 'https://example.test/vehiculos/42/cover.jpg'
const response = (overrides: Partial<PortalModelsResponse> = {}): PortalModelsResponse => ({
  status: 'ready', modelos: [model(1), model(2)], exchange_rate: null,
  fuente_precios: { nombre: 'Guía de precios ACARA', fecha: '2026-10-19' }, ...overrides,
})
const renderPanel = (view: PortalModelsView, onRetry = vi.fn()) =>
  render(<PortalModelsPanel view={view} onRetry={onRetry} />)
const ready = (overrides: Partial<PortalModelsResponse> = {}): PortalModelsView =>
  ({ status: 'ready', response: response(overrides) })

const NOTICE = 'Estos son modelos, no unidades en venta. La foto muestra cómo es el modelo. Elegí un portal y te llevamos a la búsqueda ya armada para que veas las unidades reales.'

it('HU06 shows the models-not-units message in an aside outside the list, one card per model and the dated price source', () => {
  renderPanel(ready())
  const notice = screen.getByText(NOTICE)
  expect(notice).toBeVisible()
  expect(notice.className).toMatch(/notice/)
  const aside = screen.getByRole('complementary', { name: 'Sobre estos modelos' })
  expect(within(aside).getByText(NOTICE)).toBe(notice)
  const list = screen.getByRole('list', { name: 'Modelos en otros portales' })
  expect(aside.contains(list)).toBe(false)
  expect(aside.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(list).getAllByRole('listitem', { name: /Toyota Etios/ })).toHaveLength(2)
  expect(screen.getByText('Precios de referencia: Guía de precios ACARA, 19/10/2026')).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('HU06 shows no illustrative-photo wording anywhere', () => {
  renderPanel(ready({ modelos: [model(1, { imagen_url: photo })] }))
  expect(screen.queryByText(/ilustrativa/i)).not.toBeInTheDocument()
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
  expect(within(card).getAllByText('Hatchback').at(-1)).toBeVisible()
  expect(within(card).queryByRole('img')).not.toBeInTheDocument()
  expect(within(card).getByText('Sin fotos')).toBeVisible()
  expect(within(card).queryByText('Foto ilustrativa')).not.toBeInTheDocument()
  expect(within(card).getAllByRole('link')).toHaveLength(2)
})

it('HU06 has no "Ver motivos y filtros" disclosure on the card', () => {
  renderPanel(ready({ modelos: [model(1)] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  expect(within(card).queryByText('Ver motivos y filtros')).not.toBeInTheDocument()
  expect(card.querySelector('details')).toBeNull()
})

it('HU06 puts reasons, filter chips and the Kavak note in an info tooltip at the end of the title row', async () => {
  renderPanel(ready({ modelos: [model(1)] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  const info = within(card).getByRole('button', { name: 'Más información sobre Toyota Etios 1' })
  const tooltip = within(card).getByRole('tooltip', { hidden: true })
  expect(tooltip).not.toBeVisible()
  expect(info.parentElement?.parentElement).toBe(within(card).getByText('Toyota Etios 1').parentElement)

  await userEvent.hover(info)

  expect(tooltip).toBeVisible()
  expect(within(tooltip).getByText('Por qué te lo recomendamos')).toBeInTheDocument()
  const reasons = within(tooltip).getByRole('list', { name: 'Motivos' })
  expect(within(reasons).getAllByRole('listitem').map((item) => item.textContent))
    .toEqual(['Consumo bajo', 'Apto para ciudad', '5 plazas'])
  expect(within(tooltip).getByText('Filtros que aplicamos en Mercado Libre')).toBeInTheDocument()
  const chips = within(tooltip).getByRole('list', { name: 'Filtros que aplicamos en Mercado Libre' })
  expect(within(chips).getAllByRole('listitem').map((item) => item.textContent))
    .toEqual(['Hatchback', '2017–2025', 'Hasta $ 33.000.000'])
  expect(within(tooltip).getByText('Las unidades y sus precios reales son del portal. En Kavak aplicamos solo la transmisión.')).toBeInTheDocument()
  expect(info).toHaveAccessibleDescription(/Por qué te lo recomendamos/)
})

it('HU06 opens the info tooltip with the keyboard focus and closes it with Escape', async () => {
  renderPanel(ready({ modelos: [model(1)] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  const tooltip = within(card).getByRole('tooltip', { hidden: true })

  await userEvent.tab() // The scroll region comes first.
  await userEvent.tab()
  expect(within(card).getByRole('button', { name: 'Más información sobre Toyota Etios 1' })).toHaveFocus()
  expect(tooltip).toBeVisible()

  await userEvent.keyboard('{Escape}')
  expect(tooltip).not.toBeVisible()
})

it('HU06 shows the model photo from imagen_url with its alt and lazy loading, no pill and no credit', () => {
  renderPanel(ready({ modelos: [model(1, { imagen_url: photo })] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })
  const image = within(card).getByRole('img', { name: 'Toyota Etios 1' })
  expect(image).toHaveAttribute('src', photo)
  expect(image).toHaveAttribute('loading', 'lazy')
  expect(within(card).queryByText('Sin fotos')).not.toBeInTheDocument()
  expect(within(card).queryByText('Foto ilustrativa')).not.toBeInTheDocument()
  expect(within(card).getAllByRole('link')).toHaveLength(2)
})

it('HU06 falls back to the placeholder when the photo fails to load', () => {
  renderPanel(ready({ modelos: [model(1, { imagen_url: photo })] }))
  const card = screen.getByRole('listitem', { name: 'Toyota Etios 1' })

  fireEvent.error(within(card).getByRole('img', { name: 'Toyota Etios 1' }))

  expect(within(card).queryByRole('img')).not.toBeInTheDocument()
  expect(within(card).getByText('Sin fotos')).toBeVisible()
  expect(within(card).getAllByRole('link')).toHaveLength(2)
})

it('HU06 has no photo credits, whatever the models carry', () => {
  renderPanel(ready({ modelos: [model(1, { imagen_url: photo }), model(2), model(3, { imagen_url: photo })] }))
  expect(screen.queryByText('Créditos de las fotos')).not.toBeInTheDocument()
  expect(screen.queryByText(/Wikimedia/)).not.toBeInTheDocument()
  expect(document.querySelector('details')).toBeNull()
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
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
})

it('HU06 asks to complete the diagnosis with the dealers-tab copy', () => {
  renderPanel(ready({ status: 'diagnosis_incomplete', modelos: [], fuente_precios: null }))
  expect(screen.getByText('Completá tu diagnóstico para ver recomendaciones.')).toBeVisible()
  expect(screen.getByText('Ajustá el diagnóstico para buscar otras opciones.')).toBeVisible()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
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
