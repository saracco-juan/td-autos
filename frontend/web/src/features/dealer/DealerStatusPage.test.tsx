import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/session/useAuth'
import type { User } from '../auth/types'
import { fetchSubscription } from '../subscription/api'
import { suscripcion, vigencia } from '../subscription/fixtures'
import DealerStatusPage from './DealerStatusPage'

vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../subscription/api', () => ({ fetchSubscription: vi.fn() }))

const marta: User = { id: 2, name: 'Marta', apellido: 'Gómez', email: 'marta@autosdelsur.com', rol: 'concesionaria', perfil_completo: true, tiene_diagnostico: false }

function renderPage(user: User) {
  vi.mocked(useAuth).mockReturnValue({ user, status: 'authenticated', login: vi.fn(), refresh: vi.fn(), logout: vi.fn() })
  render(<DealerStatusPage />)
}

const dealerIn = (estado_alta: string | null): User => ({ ...marta, concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta } })

describe('DealerStatusPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
    vi.mocked(fetchSubscription).mockReset()
    vi.mocked(fetchSubscription).mockRejectedValue(new Error('offline'))
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 12, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
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
    ['suspendida', 'Sin información de estado'],
    [null, 'Sin información de estado'],
  ])('TC-46: shows the status of a dealer whose state is %s', (estado, text) => {
    renderPage(dealerIn(estado))

    const card = screen.getByRole('region', { name: 'Estado de la cuenta' })
    expect(within(card).getByText(text)).toBeInTheDocument()
  })

  it('does not read the subscription of a dealer that is not active', () => {
    renderPage(dealerIn('pendiente'))

    expect(fetchSubscription).not.toHaveBeenCalled()
  })

  describe('subscription state of an active dealer (UH-20)', () => {
    const card = () => within(screen.getByRole('region', { name: 'Estado de la cuenta' }))
    const dealerWith = (vigente: Parameters<typeof vigencia>[0]) =>
      vi.mocked(fetchSubscription).mockResolvedValue(suscripcion({ estado_alta: 'activa', suscripcion: vigencia(vigente) }))

    it('shows a local loader while the subscription is read', () => {
      vi.mocked(fetchSubscription).mockReturnValue(new Promise(() => {}))
      renderPage(dealerIn('activa'))

      expect(card().getByRole('status')).toHaveTextContent('Cargando…')
      expect(screen.getByRole('heading', { level: 1, name: 'Verificación de suscripción' })).toBeInTheDocument()
    })

    it('shows the validity end of an active subscription', async () => {
      dealerWith({ estado: 'activa', vigente_hasta: '2026-11-14', gracia_hasta: '2026-11-17' })
      renderPage(dealerIn('activa'))

      expect(await card().findByText('Activa · vigente hasta el 14/11/2026')).toBeInTheDocument()
      expect(card().queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows the grace period with a warning tone', async () => {
      dealerWith({ estado: 'gracia', vigente_hasta: '2026-10-12', gracia_hasta: '2026-10-15' })
      renderPage(dealerIn('activa'))

      expect(await card().findByText('Activa · en período de gracia hasta el 15/10/2026')).toHaveAttribute('data-tone', 'warning')
    })

    it('shows an inactive subscription in red with the date the vehicles are kept until', async () => {
      dealerWith({ estado: 'inactiva', vigente_hasta: '2026-09-10', gracia_hasta: '2026-09-13', retencion_hasta: '2026-10-13' })
      renderPage(dealerIn('activa'))

      expect(await card().findByText('Inactiva · suscripción vencida')).toHaveAttribute('data-tone', 'error')
      expect(card().getByText('Tus vehículos se conservan hasta el 13/10/2026; después se eliminan definitivamente.')).toBeInTheDocument()
    })

    it.each(['2026-10-12', '2026-10-11'])('says the vehicles were deleted once the retention is reached (%s)', async (retencion) => {
      dealerWith({ estado: 'inactiva', vigente_hasta: '2026-09-10', gracia_hasta: '2026-09-13', retencion_hasta: retencion })
      renderPage(dealerIn('activa'))

      expect(await card().findByText('Inactiva · suscripción vencida')).toHaveAttribute('data-tone', 'error')
      expect(card().getByText('Tus vehículos se eliminaron al terminar el período de retención.')).toBeInTheDocument()
      expect(card().queryByText(/se conservan/)).not.toBeInTheDocument()
    })

    it('keeps the plain text when the subscription has no state yet', async () => {
      dealerWith({})
      renderPage(dealerIn('activa'))

      expect(await card().findByText('Activa')).toBeInTheDocument()
    })

    it('falls back to the session text when the subscription cannot be read', async () => {
      renderPage(dealerIn('activa'))

      await waitFor(() => expect(fetchSubscription).toHaveBeenCalled())
      expect(await card().findByText('Activa')).toBeInTheDocument()
      expect(card().queryByRole('status')).not.toBeInTheDocument()
    })
  })

  it('shows no status information for a dealer user without a dealer', () => {
    renderPage(marta)

    expect(screen.getByText('Sin información de estado')).toBeInTheDocument()
  })

  it('keeps receipt review and inventory actions outside the verification page', () => {
    renderPage(dealerIn('pendiente'))

    expect(screen.queryByText('Revisión')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ENVIAR COMPROBANTE' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'VER INVENTARIO' })).not.toBeInTheDocument()
  })
})
