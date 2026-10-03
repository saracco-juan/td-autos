import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../lib/http'
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

  it('shows an error message on other failures', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(500, {}))
    renderHome()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la información del usuario.')
  })
})
