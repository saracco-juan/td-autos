import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { searchListings } from './api'
import { LISTINGS, MERCADO_LIBRE, listing, searchResponse, sourceReport } from './fixtures'
import RecommendationsPage from './RecommendationsPage'

vi.mock('./api', () => ({ searchListings: vi.fn() }))

const MERCADO_LIBRE_DOWN = sourceReport({ estado: 'sin_respuesta' })
const OTHER_PORTAL = { clave: 'otroportal', nombre: 'Otro Portal' }
const ALL_DOWN = [MERCADO_LIBRE_DOWN, sourceReport({ ...OTHER_PORTAL, estado: 'sin_respuesta' })]

function renderPage() {
  render(
    <MemoryRouter>
      <RecommendationsPage />
    </MemoryRouter>,
  )
}

async function loaded() {
  renderPage()
  await screen.findByRole('list', { name: 'Publicaciones' })
}

const searchField = () => screen.getByRole('searchbox', { name: 'Buscar por marca, modelo o versión' })

describe('RecommendationsPage', () => {
  beforeEach(() => {
    vi.mocked(searchListings).mockReset()
    vi.mocked(searchListings).mockResolvedValue(searchResponse())
  })

  it('shows a loader on the results section only while the listings load', () => {
    vi.mocked(searchListings).mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    expect(screen.getByRole('heading', { level: 1, name: 'Mejores opciones para vos' })).toBeInTheDocument()
    expect(searchField()).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders the header of Figma 38:168 with the listing count', async () => {
    await loaded()

    expect(screen.getByText('AUTOS RECOMENDADOS')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Mejores opciones para vos' })).toBeInTheDocument()
    expect(screen.getByText('Mostrando 3 vehículos')).toBeInTheDocument()
    expect(searchField()).toHaveAttribute('placeholder', 'Ej: Corolla automático 2021')
  })

  it('says "vehículo" in the singular for a single listing', async () => {
    vi.mocked(searchListings).mockResolvedValue(searchResponse({ publicaciones: [listing()] }))
    await loaded()

    expect(screen.getByText('Mostrando 1 vehículo')).toBeInTheDocument()
  })

  it('AJUSTAR DIAGNÓSTICO leads to the diagnosis', async () => {
    await loaded()

    expect(screen.getByRole('link', { name: 'AJUSTAR DIAGNÓSTICO' })).toHaveAttribute('href', '/diagnostico')
  })

  // TC-18
  it('lists every listing as a card with its formatted line and source tag', async () => {
    await loaded()

    const cards = within(screen.getByRole('list', { name: 'Publicaciones' })).getAllByRole('listitem')
    expect(cards).toHaveLength(LISTINGS.length)
    const first = screen.getByRole('listitem', { name: 'Toyota Corolla XEI 2021' })
    expect(within(first).getByText('$ 28.900.000 · 62.000 km · CABA')).toBeInTheDocument()
    expect(within(first).getByText('Mercado Libre')).toBeInTheDocument()
    expect(screen.getByText('Sin imagen')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('searches once on load, with no query', async () => {
    await loaded()

    expect(searchListings).toHaveBeenCalledTimes(1)
    expect(searchListings).toHaveBeenCalledWith(undefined)
  })

  // TC-19
  it('names the failed source in a notice and still shows the cards of the others', async () => {
    vi.mocked(searchListings).mockResolvedValue(
      searchResponse({ fuentes: [MERCADO_LIBRE_DOWN, sourceReport(OTHER_PORTAL)] }),
    )
    await loaded()

    expect(
      screen.getByText(
        'No pudimos obtener las publicaciones de Mercado Libre. Te mostramos las del resto de los portales.',
      ),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Publicaciones' })).getAllByRole('listitem')).toHaveLength(LISTINGS.length)
    expect(screen.queryByRole('button', { name: 'REINTENTAR' })).not.toBeInTheDocument()
  })

  it('joins several failed sources with "y"', async () => {
    vi.mocked(searchListings).mockResolvedValue(
      searchResponse({ fuentes: [...ALL_DOWN, sourceReport({ clave: 'tercero', nombre: 'Tercero' })] }),
    )
    await loaded()

    expect(
      screen.getByText(
        'No pudimos obtener las publicaciones de Mercado Libre y Otro Portal. Te mostramos las del resto de los portales.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the error state with a retry when every source fails, and retrying searches again', async () => {
    vi.mocked(searchListings).mockResolvedValueOnce(searchResponse({ publicaciones: [], fuentes: ALL_DOWN }))
    const user = userEvent.setup()
    renderPage()

    expect(
      await screen.findByText('No pudimos obtener publicaciones de los portales. Probá de nuevo en unos minutos.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByText('Mostrando 0 vehículos')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'REINTENTAR' }))

    expect(await screen.findByRole('list', { name: 'Publicaciones' })).toBeInTheDocument()
    expect(searchListings).toHaveBeenCalledTimes(2)
  })

  it('shows the error state, not the notice, when the only source fails', async () => {
    vi.mocked(searchListings).mockResolvedValue(searchResponse({ publicaciones: [], fuentes: [MERCADO_LIBRE_DOWN] }))
    renderPage()

    expect(await screen.findByRole('button', { name: 'REINTENTAR' })).toBeInTheDocument()
    expect(screen.queryByText(/Te mostramos las del resto/)).not.toBeInTheDocument()
  })

  it('retries with the text of the last search', async () => {
    const user = userEvent.setup()
    await loaded()
    vi.mocked(searchListings).mockResolvedValueOnce(searchResponse({ publicaciones: [], fuentes: [MERCADO_LIBRE_DOWN] }))

    await user.type(searchField(), 'corolla{Enter}')
    await user.click(await screen.findByRole('button', { name: 'REINTENTAR' }))

    expect(searchListings).toHaveBeenLastCalledWith('corolla')
    expect(searchListings).toHaveBeenCalledTimes(3)
  })

  it('shows the empty state when every source answered with no listings', async () => {
    vi.mocked(searchListings).mockResolvedValue(searchResponse({ publicaciones: [] }))
    renderPage()

    expect(await screen.findByText('No encontramos publicaciones para tu búsqueda.')).toBeInTheDocument()
    expect(screen.queryByText('Probá con otra marca, modelo o versión.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'REINTENTAR' })).not.toBeInTheDocument()
  })

  it('suggests changing the search when a text was typed and nothing matched', async () => {
    const user = userEvent.setup()
    await loaded()
    vi.mocked(searchListings).mockResolvedValue(searchResponse({ publicaciones: [] }))

    await user.type(searchField(), 'zzz{Enter}')

    expect(await screen.findByText('No encontramos publicaciones para tu búsqueda.')).toBeInTheDocument()
    expect(screen.getByText('Probá con otra marca, modelo o versión.')).toBeInTheDocument()
  })

  it('keeps the notice above an empty list when a source failed and the others had nothing', async () => {
    vi.mocked(searchListings).mockResolvedValue(
      searchResponse({ publicaciones: [], fuentes: [MERCADO_LIBRE_DOWN, sourceReport(OTHER_PORTAL)] }),
    )
    renderPage()

    expect(await screen.findByText('No encontramos publicaciones para tu búsqueda.')).toBeInTheDocument()
    expect(screen.getByText(/No pudimos obtener las publicaciones de Mercado Libre/)).toBeInTheDocument()
  })

  it('submits the trimmed text on Enter', async () => {
    const user = userEvent.setup()
    await loaded()

    await user.type(searchField(), '  Corolla automático  {Enter}')

    await waitFor(() => expect(searchListings).toHaveBeenLastCalledWith('Corolla automático'))
    expect(searchListings).toHaveBeenCalledTimes(2)
  })

  it('submits the text with the BUSCAR button', async () => {
    const user = userEvent.setup()
    await loaded()

    await user.type(searchField(), 'Fiat')
    await user.click(screen.getByRole('button', { name: 'BUSCAR' }))

    await waitFor(() => expect(searchListings).toHaveBeenLastCalledWith('Fiat'))
  })

  it('searches without a query when the text is blank', async () => {
    const user = userEvent.setup()
    await loaded()

    await user.type(searchField(), '   {Enter}')

    await waitFor(() => expect(searchListings).toHaveBeenCalledTimes(2))
    expect(searchListings).toHaveBeenLastCalledWith(undefined)
  })

  it('does not search again while a search is loading', async () => {
    vi.mocked(searchListings).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()

    await user.type(searchField(), 'Fiat{Enter}')
    await user.click(screen.getByRole('button', { name: 'BUSCAR' }))

    expect(searchListings).toHaveBeenCalledTimes(1)
  })

  it('shows an inline message on the field when the text is over 100 characters (422) and keeps the list', async () => {
    const user = userEvent.setup()
    await loaded()
    vi.mocked(searchListings).mockRejectedValue(new HttpError(422, { errors: { q: ['too long'] } }))

    await user.type(searchField(), 'x{Enter}')

    expect(await screen.findByText('Usá hasta 100 caracteres.')).toBeInTheDocument()
    expect(searchField()).toHaveAttribute('aria-invalid', 'true')
    expect(within(screen.getByRole('list', { name: 'Publicaciones' })).getAllByRole('listitem')).toHaveLength(LISTINGS.length)

    vi.mocked(searchListings).mockResolvedValue(searchResponse())
    await user.type(searchField(), 'y{Enter}')

    await waitFor(() => expect(screen.queryByText('Usá hasta 100 caracteres.')).not.toBeInTheDocument())
  })

  it('shows the no-connection error state with a retry when the request never got an answer', async () => {
    vi.mocked(searchListings).mockRejectedValueOnce(new NetworkError(new TypeError('Failed to fetch')))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Sin conexión con el servidor')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'REINTENTAR' }))

    expect(await screen.findByRole('list', { name: 'Publicaciones' })).toBeInTheDocument()
  })

  it('shows the generic error state on a server error', async () => {
    vi.mocked(searchListings).mockRejectedValue(new HttpError(500, undefined))
    renderPage()

    expect(await screen.findByText('Algo salió mal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'REINTENTAR' })).toBeInTheDocument()
  })

  it('S1: has no match percentage, best-match tag, COMPARAR or VER FICHA', async () => {
    await loaded()

    expect(screen.queryByText(/coincidencia/i)).not.toBeInTheDocument()
    expect(screen.queryByText('COMPARAR')).not.toBeInTheDocument()
    expect(screen.queryByText('VER FICHA')).not.toBeInTheDocument()
  })

  it('tags each card with the name of its own source', async () => {
    vi.mocked(searchListings).mockResolvedValue(
      searchResponse({ publicaciones: [listing({ fuente: OTHER_PORTAL }), listing({ id: 2, fuente: MERCADO_LIBRE })] }),
    )
    await loaded()

    expect(screen.getByText('Otro Portal')).toBeInTheDocument()
    expect(screen.getByText('Mercado Libre')).toBeInTheDocument()
  })
})
