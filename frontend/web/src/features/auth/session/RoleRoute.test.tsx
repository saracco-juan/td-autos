import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../types'
import RoleRoute from './RoleRoute'
import { useAuth } from './useAuth'

vi.mock('./useAuth', () => ({ useAuth: vi.fn() }))

const buyer: User = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', perfil_completo: false, tiene_diagnostico: true }
const dealer: User = { ...buyer, rol: 'concesionaria', concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta: 'pendiente' } }

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

  it.each(['/', '/diagnostico'])('sends a dealer opening the buyer route %s to /concesionaria', (path) => {
    renderAt(path, dealer)

    expect(screen.getByText('Estado de la concesionaria')).toBeInTheDocument()
    expect(screen.queryByText('Diagnóstico')).not.toBeInTheDocument()
  })

  it('sends a buyer opening a dealer route to /', () => {
    renderAt('/concesionaria', buyer)

    expect(screen.getByText('Inicio del comprador')).toBeInTheDocument()
    expect(screen.queryByText('Estado de la concesionaria')).not.toBeInTheDocument()
  })
})
