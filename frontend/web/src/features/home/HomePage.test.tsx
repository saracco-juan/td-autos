import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { fetchCurrentUser } from '../auth/api'
import HomePage from './HomePage'

vi.mock('../auth/api', () => ({ fetchCurrentUser: vi.fn() }))

function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/registro" element={<h1>Registro</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
  })

  it('TC-02: shows the logged-in user fetched from the API', async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      id: 7,
      name: 'Ana',
      apellido: 'Pérez',
      email: 'ana@example.com',
      rol: 'comprador',
    })
    renderHome()

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  })

  it('shows only the name when the user has no apellido', async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      id: 8,
      name: 'Beto',
      apellido: null,
      email: 'beto@example.com',
      rol: 'comprador',
    })
    renderHome()

    expect(await screen.findByText('Beto')).toBeInTheDocument()
  })

  it('redirects to /registro when the session is not authenticated (401)', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(401, { message: 'Unauthenticated.' }))
    renderHome()

    expect(await screen.findByRole('heading', { name: 'Registro' })).toBeInTheDocument()
  })

  it('shows a connection error when the server cannot be reached', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))
    renderHome()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Sin conexión con el servidor')
    expect(screen.queryByRole('heading', { name: 'Inicio' })).not.toBeInTheDocument()
    expect(alert.querySelector('svg[data-icon="network"]')).not.toBeNull()
  })

  it('shows a generic error when the server fails', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(500, {}))
    renderHome()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Algo salió mal')
    expect(alert.querySelector('svg[data-icon="server"]')).not.toBeNull()
  })
})
