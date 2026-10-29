import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listFavorites, setFavorite } from './api'
import FavoritesPage from './FavoritesPage'

vi.mock('./api', () => ({ listFavorites: vi.fn(), setFavorite: vi.fn() }))
vi.mock('../recommendations/matching', () => ({ fetchRecommendations: vi.fn().mockResolvedValue({ results: [] }) }))

const vehicle = {
  id: 12, marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021,
  precio: 28900000, moneda: 'ARS' as const, kilometraje: 62000,
  transmision: 'automatica' as const, combustible: 'nafta' as const, ubicacion: 'CABA', image_url: '/corolla.jpg',
}
const response = (data = [vehicle], total = data.length, page = 1, lastPage = 1) => ({
  data, meta: { current_page: page, per_page: 6, last_page: lastPage, total },
})
function renderPage() {
  return render(<MemoryRouter initialEntries={['/favoritos']}>
    <Routes><Route path="/favoritos" element={<FavoritesPage />} /><Route path="/vehiculos/:id" element={<DetailStub />} /></Routes>
  </MemoryRouter>)
}

function DetailStub() {
  const location = useLocation()
  return <p>Ficha {JSON.stringify(location.state)}</p>
}

describe('FavoritesPage', () => {
  beforeEach(() => {
    vi.mocked(listFavorites).mockReset()
    vi.mocked(setFavorite).mockReset().mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  it('shows saved vehicles and links to their detail with the favorites return location', async () => {
    vi.mocked(listFavorites).mockResolvedValue(response())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Vehículos guardados' })).toBeInTheDocument()
    expect(await screen.findByText('Toyota Corolla XEI 2021')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'VER FICHA' })).toHaveAttribute('href', '/vehiculos/12')
    await userEvent.click(screen.getByRole('link', { name: 'VER FICHA' }))
    expect(await screen.findByText('Ficha {"returnTo":"/favoritos"}')).toBeInTheDocument()
  })

  it('shows a useful empty state and recommendation action', async () => {
    vi.mocked(listFavorites).mockResolvedValue(response([], 0))
    renderPage()

    expect(await screen.findByText('Todavía no guardaste vehículos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'VER RECOMENDADOS' })).toHaveAttribute('href', '/recomendaciones')
  })

  it('removes a favorite and can restore it with Deshacer', async () => {
    vi.mocked(listFavorites).mockResolvedValueOnce(response()).mockResolvedValueOnce(response([], 0)).mockResolvedValue(response())
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('Toyota Corolla XEI 2021')
    await user.click(screen.getByRole('button', { name: 'QUITAR' }))

    expect(setFavorite).toHaveBeenCalledWith(12, false)
    expect(await screen.findByText('Quitaste Toyota Corolla XEI 2021 de tus favoritos.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(setFavorite).toHaveBeenLastCalledWith(12, true)
    expect(await screen.findByText('Toyota Corolla XEI 2021')).toBeInTheDocument()
  })

  it('shows a retryable error when favorites cannot be loaded', async () => {
    vi.mocked(listFavorites).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response())
    renderPage()
    const user = userEvent.setup()

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal')
    await user.click(screen.getByRole('button', { name: 'REINTENTAR' }))
    expect(await screen.findByText('Toyota Corolla XEI 2021')).toBeInTheDocument()
  })

  it('keeps the favorite visible and reports a failed removal', async () => {
    vi.mocked(listFavorites).mockResolvedValue(response())
    vi.mocked(setFavorite).mockRejectedValueOnce(new Error('offline'))
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('Toyota Corolla XEI 2021')
    await user.click(screen.getByRole('button', { name: 'QUITAR' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos actualizar tus favoritos')
    expect(screen.getByText('Toyota Corolla XEI 2021')).toBeInTheDocument()
  })

  it('offers whole-row page sizes and keeps pagination visible when the selected size fits', async () => {
    vi.mocked(listFavorites).mockResolvedValue(response([vehicle], 8, 1, 2))
    renderPage()

    expect(await screen.findByText('8 vehículos guardados')).toBeInTheDocument()
    expect(screen.getByLabelText('Mostrar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 2' })).toBeInTheDocument()
  })
})
