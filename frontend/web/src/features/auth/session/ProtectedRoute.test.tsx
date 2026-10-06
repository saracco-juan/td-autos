import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../../lib/http'
import { fetchCurrentUser } from '../api'
import AuthProvider from './AuthProvider'
import ProtectedRoute from './ProtectedRoute'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  fetchCurrentUser: vi.fn(),
}))

const ana = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', perfil_completo: false }

function renderGuarded() {
  render(
    <MemoryRouter initialEntries={['/privado']}>
      <AuthProvider>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/privado" element={<p>Contenido privado</p>} />
          </Route>
          <Route path="/login" element={<p>Pantalla de login</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
  })

  it('shows a loading placeholder, not the content, while the session loads', () => {
    vi.mocked(fetchCurrentUser).mockReturnValue(new Promise(() => {}))
    renderGuarded()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument()
  })

  it('TC-84: redirects a guest to /login without rendering the protected content', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(401, undefined))
    renderGuarded()

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument()
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
  })

  it('renders the protected content for an authenticated user', async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue(ana)
    renderGuarded()

    expect(await screen.findByText('Contenido privado')).toBeInTheDocument()
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument()
  })
})
