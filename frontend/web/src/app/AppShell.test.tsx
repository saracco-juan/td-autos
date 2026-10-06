import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../features/auth/session/useAuth'
import AppShell from './AppShell'

vi.mock('../features/auth/session/useAuth', () => ({ useAuth: vi.fn() }))

const ana = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', perfil_completo: false }

function mockAuth(status: 'authenticated' | 'guest', logout = vi.fn().mockResolvedValue(undefined)) {
  vi.mocked(useAuth).mockReturnValue({
    user: status === 'authenticated' ? ana : null,
    status,
    login: vi.fn(),
    refresh: vi.fn(),
    logout,
  })
  return logout
}

function renderShell() {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>Contenido</p>} />
        </Route>
        <Route path="/login" element={<p>Pantalla de ingreso</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  it('renders the guest nav, the routed content and the footer', () => {
    mockAuth('guest')
    renderShell()

    expect(screen.getByRole('link', { name: 'TD Autos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('main')).toHaveTextContent('Contenido')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2026 TD Autos. Todos los derechos reservados.')
  })

  it('shows no logout button to a guest', () => {
    mockAuth('guest')
    renderShell()

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('shows the logo and a logout button to an authenticated user, and nothing else in the nav', () => {
    mockAuth('authenticated')
    renderShell()

    const banner = screen.getByRole('banner')
    expect(screen.getByRole('link', { name: 'TD Autos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute('type', 'button')
    expect(banner.querySelectorAll('a')).toHaveLength(1)
    expect(banner.querySelectorAll('button')).toHaveLength(1)
  })

  it('TC-83: pressing Cerrar sesión logs out and goes to the login screen', async () => {
    const logout = mockAuth('authenticated')
    renderShell()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(logout).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
  })

  it('disables the button and marks it busy while the request is in flight', async () => {
    let finish!: () => void
    const logout = mockAuth(
      'authenticated',
      vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
    )
    renderShell()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    const button = screen.getByRole('button', { name: 'Cerrar sesión' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(logout).toHaveBeenCalledTimes(1)

    finish()
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
  })

  it('shows an alert, stays on the page and re-enables the button when logout fails', async () => {
    const logout = mockAuth('authenticated', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    renderShell()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión. Intentá nuevamente.')
    expect(screen.getByText('Contenido')).toBeInTheDocument()
    expect(screen.queryByText('Pantalla de ingreso')).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Cerrar sesión' })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-busy', 'true')
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('clears the alert when logging out is retried', async () => {
    const logout = mockAuth(
      'authenticated',
      vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(undefined),
    )
    renderShell()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
    expect(logout).toHaveBeenCalledTimes(2)
  })
})
