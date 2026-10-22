import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../types'
import RoleRoute from './RoleRoute'
import { useAuth } from './useAuth'

vi.mock('./useAuth', () => ({ useAuth: vi.fn() }))

const buyer: User = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', perfil_completo: false, tiene_diagnostico: true }
const dealer: User = { ...buyer, rol: 'concesionaria', concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta: 'pendiente' } }
const admin: User = { ...buyer, rol: 'administrador', tiene_diagnostico: false }

function renderAt(path: string, user: User) {
  vi.mocked(useAuth).mockReturnValue({ user, status: 'authenticated', login: vi.fn(), refresh: vi.fn(), logout: vi.fn() })
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RoleRoute allow="buyer" />}>
          <Route path="/" element={<p>Inicio del comprador</p>} />
          <Route path="/diagnostico" element={<p>Diagnóstico</p>} />
        </Route>
        <Route element={<RoleRoute allow="dealer" />}>
          <Route path="/concesionaria" element={<p>Estado de la concesionaria</p>} />
          <Route path="/concesionaria/suscripcion" element={<p>Suscripción de la concesionaria</p>} />
        </Route>
        <Route element={<RoleRoute allow="admin" />}>
          <Route path="/admin" element={<p>Panel de administración</p>} />
          <Route path="/admin/concesionarias" element={<p>Concesionarias</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoleRoute', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  it('renders a buyer route for a buyer', () => {
    renderAt('/diagnostico', buyer)

    expect(screen.getByText('Diagnóstico')).toBeInTheDocument()
  })

  it('renders a dealer route for a dealer', () => {
    renderAt('/concesionaria', dealer)

    expect(screen.getByText('Estado de la concesionaria')).toBeInTheDocument()
  })

  it.each(['/', '/diagnostico'])('sends a dealer opening the buyer route %s to the subscription screen', (path) => {
    renderAt(path, dealer)

    expect(screen.getByText('Suscripción de la concesionaria')).toBeInTheDocument()
    expect(screen.queryByText('Estado de la concesionaria')).not.toBeInTheDocument()
    expect(screen.queryByText('Diagnóstico')).not.toBeInTheDocument()
  })

  it('sends a buyer opening a dealer route to /', () => {
    renderAt('/concesionaria', buyer)

    expect(screen.getByText('Inicio del comprador')).toBeInTheDocument()
    expect(screen.queryByText('Estado de la concesionaria')).not.toBeInTheDocument()
  })

  it.each(['/admin', '/admin/concesionarias'])('UH19: renders the admin route %s for an administrator', (path) => {
    renderAt(path, admin)

    expect(screen.getByText(path === '/admin' ? 'Panel de administración' : 'Concesionarias')).toBeInTheDocument()
  })

  it.each(['/', '/diagnostico', '/concesionaria'])('UH19: sends an administrator opening %s to /admin', (path) => {
    renderAt(path, admin)

    expect(screen.getByText('Panel de administración')).toBeInTheDocument()
    expect(screen.queryByText('Inicio del comprador')).not.toBeInTheDocument()
    expect(screen.queryByText('Diagnóstico')).not.toBeInTheDocument()
    expect(screen.queryByText('Estado de la concesionaria')).not.toBeInTheDocument()
  })

  it('UH19: sends a buyer opening an admin route to /', () => {
    renderAt('/admin/concesionarias', buyer)

    expect(screen.getByText('Inicio del comprador')).toBeInTheDocument()
    expect(screen.queryByText('Concesionarias')).not.toBeInTheDocument()
  })

  it('UH19: sends a dealer opening an admin route to the subscription screen', () => {
    renderAt('/admin', dealer)

    expect(screen.getByText('Suscripción de la concesionaria')).toBeInTheDocument()
    expect(screen.queryByText('Panel de administración')).not.toBeInTheDocument()
  })

  describe.each([
    ['an unknown role', { ...buyer, rol: 'admin' }],
    ['a missing role', { ...buyer, rol: undefined as unknown as string }],
  ])('a signed-in user with %s', (_label, user) => {
    it.each(['/', '/diagnostico', '/concesionaria', '/admin'])('is denied at %s in place, without bouncing between roles', (path) => {
      renderAt(path, user)

      expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para realizar esta acción.')
      expect(screen.queryByText('Inicio del comprador')).not.toBeInTheDocument()
      expect(screen.queryByText('Diagnóstico')).not.toBeInTheDocument()
      expect(screen.queryByText('Estado de la concesionaria')).not.toBeInTheDocument()
      expect(screen.queryByText('Panel de administración')).not.toBeInTheDocument()
    })
  })
})
