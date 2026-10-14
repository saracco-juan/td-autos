import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/session/useAuth'
import type { User } from '../auth/types'
import DealerStatusPage from './DealerStatusPage'

vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))

const marta: User = { id: 2, name: 'Marta', apellido: 'Gómez', email: 'marta@autosdelsur.com', rol: 'concesionaria', perfil_completo: true, tiene_diagnostico: false }

function renderPage(user: User) {
  vi.mocked(useAuth).mockReturnValue({ user, status: 'authenticated', login: vi.fn(), refresh: vi.fn(), logout: vi.fn() })
  render(<DealerStatusPage />)
}

const dealerIn = (estado_alta: string | null): User => ({ ...marta, concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta } })

describe('DealerStatusPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  it('renders the page header and the account status card', () => {
    renderPage(dealerIn('pendiente'))

    expect(screen.getByRole('heading', { level: 1, name: 'Verificación de suscripción' })).toBeInTheDocument()
    expect(screen.getByText('Estado de tu solicitud de adhesión.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Estado de la cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Estado de la cuenta' })).toBeInTheDocument()
  })

  it.each([
    ['pendiente', 'Pendiente de aprobación inicial · inventario bloqueado'],
    ['activa', 'Activa'],
    ['suspendida', 'Sin información de estado'],
    [null, 'Sin información de estado'],
  ])('TC-46: shows the status of a dealer whose state is %s', (estado, text) => {
    renderPage(dealerIn(estado))

    const card = screen.getByRole('region', { name: 'Estado de la cuenta' })
    expect(within(card).getByText(text)).toBeInTheDocument()
  })

  it('shows no status information for a dealer user without a dealer', () => {
    renderPage(marta)

    expect(screen.getByText('Sin información de estado')).toBeInTheDocument()
  })

  it('leaves the receipt review and the inventory button to later stories', () => {
    renderPage(dealerIn('pendiente'))

    expect(screen.queryByText('Revisión')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
