import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/session/useAuth'
import type { User } from '../auth/types'
import ActiveDealerRoute from './ActiveDealerRoute'

vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))

const marta: User = { id: 2, name: 'Marta', apellido: 'Gómez', email: 'marta@autosdelsur.com', rol: 'concesionaria', perfil_completo: true, tiene_diagnostico: false }

const dealerIn = (estado_alta: string | null): User => ({ ...marta, concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta } })

function renderGuarded(user: User) {
  vi.mocked(useAuth).mockReturnValue({ user, status: 'authenticated', login: vi.fn(), refresh: vi.fn(), logout: vi.fn() })
  render(
    <MemoryRouter initialEntries={['/concesionaria/inventario']}>
      <Routes>
        <Route element={<ActiveDealerRoute />}>
          <Route path="/concesionaria/inventario" element={<p>Inventario</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('ActiveDealerRoute', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  it('renders the route content for an active dealer', () => {
    renderGuarded(dealerIn('activa'))

    expect(screen.getByText('Inventario')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('TC-45: denies a pending dealer with the pending message and a way back', () => {
    renderGuarded(dealerIn('pendiente'))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tu cuenta está pendiente de aprobación. Todavía no podés gestionar el inventario.',
    )
    expect(screen.getByRole('link', { name: 'Volver a verificación' })).toHaveAttribute('href', '/concesionaria')
    expect(screen.queryByText('Inventario')).not.toBeInTheDocument()
  })

  it.each([
    ['another non-active state', dealerIn('suspendida')],
    ['no state', dealerIn(null)],
    ['a dealer user without a dealer', marta],
    ['a buyer', { ...marta, rol: 'comprador' }],
  ])('denies %s with the generic message', (_label, user) => {
    renderGuarded(user)

    expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para realizar esta acción.')
    expect(screen.getByRole('link', { name: 'Volver a verificación' })).toHaveAttribute('href', '/concesionaria')
    expect(screen.queryByText('Inventario')).not.toBeInTheDocument()
  })
})
