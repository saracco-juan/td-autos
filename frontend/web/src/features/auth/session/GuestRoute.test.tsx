import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../../lib/http'
import { fetchCurrentUser } from '../api'
import AuthProvider from './AuthProvider'
import GuestRoute from './GuestRoute'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  fetchCurrentUser: vi.fn(),
}))

const ana = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', perfil_completo: false, tiene_diagnostico: true }

function renderGuestOnly() {
  render(
    <MemoryRouter initialEntries={['/ingresar']}>
      <AuthProvider>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/ingresar" element={<p>Formulario para invitados</p>} />
          </Route>
          <Route path="/" element={<p>Pantalla principal</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('GuestRoute', () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
  })

  it('shows a loading placeholder, not the content, while the session loads', () => {
    vi.mocked(fetchCurrentUser).mockReturnValue(new Promise(() => {}))
    renderGuestOnly()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    expect(screen.queryByText('Formulario para invitados')).not.toBeInTheDocument()
    expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
  })

  it('renders the content for a guest', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(401, undefined))
    renderGuestOnly()

    expect(await screen.findByText('Formulario para invitados')).toBeInTheDocument()
  })

  it('shows the connection error instead of the content when the session cannot be read', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))
    renderGuestOnly()

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión con el servidor')
    expect(screen.queryByText('Formulario para invitados')).not.toBeInTheDocument()
    expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
  })

  it('shows the server error instead of the content when the session read fails with a 500', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(500, undefined))
    renderGuestOnly()

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal')
    expect(screen.queryByText('Formulario para invitados')).not.toBeInTheDocument()
  })

  it('redirects an authenticated user to /', async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue(ana)
    renderGuestOnly()

    expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
    expect(screen.queryByText('Formulario para invitados')).not.toBeInTheDocument()
  })
})
