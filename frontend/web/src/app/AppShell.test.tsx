import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../features/auth/session/useAuth'
import AppShell from './AppShell'

vi.mock('../features/auth/session/useAuth', () => ({ useAuth: vi.fn() }))

const ana = {
  id: 1,
  name: 'Ana',
  apellido: null,
  email: 'ana@example.com',
  rol: 'comprador',
  perfil_completo: false,
  tiene_diagnostico: true,
}

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

function renderShell(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>Contenido</p>} />
          <Route path="*" element={<p>Otra pantalla</p>} />
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

  it('shows no profile link to a guest', () => {
    mockAuth('guest')
    renderShell()

    expect(screen.queryByRole('link', { name: 'Perfil' })).not.toBeInTheDocument()
  })

  it('shows the logo, the diagnosis, recommendations and profile links and a logout button to an authenticated user, and nothing else in the nav', () => {
    mockAuth('authenticated')
    renderShell()

    const banner = screen.getByRole('banner')
    expect(screen.getByRole('link', { name: 'TD Autos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Diagnóstico' })).toHaveAttribute('href', '/diagnostico')
    expect(screen.getByRole('link', { name: 'Recomendados' })).toHaveAttribute('href', '/recomendaciones')
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/perfil')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute('type', 'button')
    expect(banner.querySelectorAll('a')).toHaveLength(4)
    expect(banner.querySelectorAll('button')).toHaveLength(1)
  })

  it('orders the nav as in Figma: Diagnóstico, Recomendados, Perfil, Cerrar sesión', () => {
    mockAuth('authenticated')
    renderShell()

    const items = within(screen.getByRole('banner')).getAllByRole('link').slice(1)
    expect(items.map((item) => item.textContent)).toEqual(['Diagnóstico', 'Recomendados', 'Perfil'])
    const logout = screen.getByRole('button', { name: 'Cerrar sesión' })
    expect(items[2].compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows no diagnosis or recommendations link to a guest', () => {
    mockAuth('guest')
    renderShell()

    expect(screen.queryByRole('link', { name: 'Diagnóstico' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Recomendados' })).not.toBeInTheDocument()
  })

  it('marks the link of the current page with aria-current', () => {
    mockAuth('authenticated')
    renderShell('/recomendaciones')

    expect(screen.getByRole('link', { name: 'Recomendados' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Diagnóstico' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Perfil' })).not.toHaveAttribute('aria-current')
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
