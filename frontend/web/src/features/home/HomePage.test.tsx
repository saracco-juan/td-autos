import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/session/useAuth'
import type { User } from '../auth/types'
import HomePage from './HomePage'

vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))

// The 401 redirect to /login is the route guard's job: see router.test.tsx (TC-84).
function renderHome(user: User | null) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    status: user ? 'authenticated' : 'guest',
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  })
  render(<HomePage />)
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  it('TC-02: shows the logged-in user from the session', () => {
    renderHome({ id: 7, name: 'Ana', apellido: 'Pérez', email: 'ana@example.com', rol: 'comprador', perfil_completo: true })

    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  })

  it('shows only the name when the user has no apellido', () => {
    renderHome({ id: 8, name: 'Beto', apellido: null, email: 'beto@example.com', rol: 'comprador', perfil_completo: false })

    expect(screen.getByText('Beto')).toBeInTheDocument()
  })

  it('renders no user section without a session user', () => {
    renderHome(null)

    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Usuario' })).not.toBeInTheDocument()
  })
})
