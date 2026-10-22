import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import AdminDashboardPage from './AdminDashboardPage'
import { fetchDealerDirectory } from './api'
import { directory } from './fixtures'

vi.mock('./api', () => ({ fetchDealerDirectory: vi.fn() }))

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/concesionarias" element={<p>Lista de concesionarias</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminDashboardPage (UH19, Figma 2101:1493)', () => {
  beforeEach(() => {
    vi.mocked(fetchDealerDirectory).mockReset()
    vi.mocked(fetchDealerDirectory).mockResolvedValue(directory({ conteos: { activas: 4, pendientes: 2, inactivas: 1 } }))
  })

  it('shows a loader while the counts load', () => {
    vi.mocked(fetchDealerDirectory).mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('shows the header and one card per dealer count', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Panel de administración' })).toBeInTheDocument()
    expect(screen.getByText('ADMINISTRACIÓN')).toBeInTheDocument()
    expect(screen.getByText('Gestioná las concesionarias registradas en la plataforma.')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Concesionarias activas' })).getByText('4')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Pendientes de aprobación' })).getByText('2')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Inactivas' })).getByText('1')).toBeInTheDocument()
  })

  it('offers the Concesionarias area, whose button opens the dealer list', async () => {
    renderPage()

    const area = await screen.findByRole('region', { name: 'Concesionarias' })
    expect(within(area).getByText('Revisá altas nuevas, aprobá comprobantes y editá los datos de cada concesionaria.')).toBeInTheDocument()
    await userEvent.setup().click(within(area).getByRole('link', { name: 'VER CONCESIONARIAS' }))

    expect(screen.getByText('Lista de concesionarias')).toBeInTheDocument()
  })

  it.each([
    ['a network failure', new NetworkError(new TypeError('Failed to fetch')), 'Sin conexión con el servidor'],
    ['a server failure', new HttpError(500, undefined), 'Algo salió mal'],
  ])('shows the error state after %s, and REINTENTAR loads the counts', async (_label, failure, title) => {
    vi.mocked(fetchDealerDirectory).mockRejectedValueOnce(failure)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(title)
    await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Panel de administración' })).toBeInTheDocument()
    expect(fetchDealerDirectory).toHaveBeenCalledTimes(2)
  })
})
