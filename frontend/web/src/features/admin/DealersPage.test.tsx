import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { fetchDealerDirectory } from './api'
import DealersPage from './DealersPage'
import { dealerRow, directory } from './fixtures'

vi.mock('./api', () => ({ fetchDealerDirectory: vi.fn() }))

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/concesionarias']}>
      <Routes>
        <Route path="/admin/concesionarias" element={<DealersPage />} />
        <Route path="/admin/comprobantes/:id" element={<p>Revisión del comprobante</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) })

describe('DealersPage (UH19, Figma 38:1037)', () => {
  beforeEach(() => {
    vi.mocked(fetchDealerDirectory).mockReset()
    vi.mocked(fetchDealerDirectory).mockResolvedValue(directory())
  })

  it('shows a loader while the list loads', () => {
    vi.mocked(fetchDealerDirectory).mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  })

  it('shows the header with the number of registered dealers', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Concesionarias' })).toBeInTheDocument()
    expect(screen.getByText('ADMINISTRACIÓN')).toBeInTheDocument()
    expect(screen.getByText('3 concesionarias registradas')).toBeInTheDocument()
  })

  it('uses the singular for a single dealer', async () => {
    vi.mocked(fetchDealerDirectory).mockResolvedValue(directory({ concesionarias: [dealerRow()] }))
    renderPage()

    expect(await screen.findByText('1 concesionaria registrada')).toBeInTheDocument()
  })

  it('shows the Figma columns and one row per dealer in the order the API sends them', async () => {
    renderPage()

    const table = await screen.findByRole('table', { name: 'Concesionarias' })
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent)
    expect(headers).toEqual(['Concesionaria', 'Localidad', 'Contacto', 'Estado', 'Acciones'])
    const names = within(table)
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent)
    expect(names).toEqual(['Concesionaria Sur', 'Automotores Centro', 'Autos Norte'])
  })

  it('shows the locality, the contact email and the state label of each dealer', async () => {
    renderPage()
    await screen.findByRole('table')

    const sur = within(row('Concesionaria Sur'))
    expect(sur.getByText('CABA')).toBeInTheDocument()
    expect(sur.getByText('sur@example.com')).toBeInTheDocument()
    expect(sur.getByText('Pendiente de aprobación')).toHaveAttribute('data-tone', 'pending')

    const centro = within(row('Automotores Centro'))
    expect(centro.getByText('Rosario, Santa Fe')).toBeInTheDocument()
    expect(centro.getByText('Activa')).toHaveAttribute('data-tone', 'active')
  })

  it('shows Inactiva with its own tone', async () => {
    vi.mocked(fetchDealerDirectory).mockResolvedValue(directory({ concesionarias: [dealerRow({ estado_alta: 'inactiva' })] }))
    renderPage()

    expect(await screen.findByText('Inactiva')).toHaveAttribute('data-tone', 'inactive')
  })

  it('VER COMPROBANTE opens the pending receipt, or the latest one when none is pending', async () => {
    renderPage()
    await screen.findByRole('table')

    expect(within(row('Concesionaria Sur')).getByRole('link', { name: 'Ver comprobante de Concesionaria Sur' })).toHaveAttribute(
      'href',
      '/admin/comprobantes/31',
    )
    expect(
      within(row('Automotores Centro')).getByRole('link', { name: 'Ver comprobante de Automotores Centro' }),
    ).toHaveAttribute('href', '/admin/comprobantes/27')

    await userEvent.setup().click(within(row('Concesionaria Sur')).getByRole('link', { name: /Ver comprobante/ }))
    expect(screen.getByText('Revisión del comprobante')).toBeInTheDocument()
  })

  it('shows "Sin comprobante" instead of VER COMPROBANTE for a dealer that never sent one, and no EDITAR (HU27)', async () => {
    renderPage()
    await screen.findByRole('table')

    const norte = within(row('Autos Norte'))
    expect(norte.queryByRole('link', { name: /Ver comprobante/ })).not.toBeInTheDocument()
    expect(norte.getByText('Sin comprobante')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
  })

  it('flags a dealer whose latest receipt was rejected, next to its unchanged state', async () => {
    vi.mocked(fetchDealerDirectory).mockResolvedValue(
      directory({
        concesionarias: [
          dealerRow({ comprobante_pendiente_id: null, ultimo_comprobante_id: 30, ultimo_comprobante_estado: 'rechazado' }),
        ],
      }),
    )
    renderPage()
    await screen.findByRole('table')

    const sur = within(row('Concesionaria Sur'))
    expect(sur.getByText('Pendiente de aprobación')).toHaveAttribute('data-tone', 'pending')
    expect(sur.getByText('Comprobante rechazado')).toHaveAttribute('data-tone', 'rejected')
    expect(sur.getByRole('link', { name: 'Ver comprobante de Concesionaria Sur' })).toHaveAttribute('href', '/admin/comprobantes/30')
  })

  it('does not flag a rejection while a newer receipt is pending, nor approved or missing receipts', async () => {
    vi.mocked(fetchDealerDirectory).mockResolvedValue(
      directory({
        concesionarias: [
          dealerRow({ comprobante_pendiente_id: 32, ultimo_comprobante_id: 32, ultimo_comprobante_estado: 'pendiente de revisión' }),
          ...directory().concesionarias.slice(1),
        ],
      }),
    )
    renderPage()
    await screen.findByRole('table')

    expect(screen.queryByText('Comprobante rechazado')).not.toBeInTheDocument()
  })

  it('shows an empty message and no table when there are no dealers', async () => {
    vi.mocked(fetchDealerDirectory).mockResolvedValue(
      directory({ conteos: { activas: 0, pendientes: 0, inactivas: 0 }, concesionarias: [] }),
    )
    renderPage()

    expect(await screen.findByText('Todavía no hay concesionarias registradas.')).toBeInTheDocument()
    expect(screen.getByText('0 concesionarias registradas')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it.each([
    ['a network failure', new NetworkError(new TypeError('Failed to fetch')), 'Sin conexión con el servidor'],
    ['a server failure', new HttpError(500, undefined), 'Algo salió mal'],
  ])('shows the error state after %s, and REINTENTAR loads the list', async (_label, failure, title) => {
    vi.mocked(fetchDealerDirectory).mockRejectedValueOnce(failure)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(title)
    await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(fetchDealerDirectory).toHaveBeenCalledTimes(2)
  })
})
