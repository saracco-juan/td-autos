import { act, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { HttpError } from '../lib/http'
import { fetchCurrentUser, loginUser, logoutUser, resetPassword } from '../features/auth/api'
import { routes } from './router'

// The session provider reads the current user: keep the router tests off the network.
vi.mock('../features/auth/api', () => ({
  fetchCurrentUser: vi.fn(),
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  GOOGLE_REDIRECT_URL: 'http://localhost:8000/auth/google/redirect',
}))

const ana = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }

function asGuest() {
  vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(401, undefined))
}

function asAuthenticated() {
  vi.mocked(fetchCurrentUser).mockResolvedValue(ana)
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('app routes', () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
    vi.mocked(logoutUser).mockReset()
    asAuthenticated()
  })

  it('renders the home placeholder at /', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('renders the register screen at /registro for a guest', async () => {
    asGuest()
    renderAt('/registro')

    expect(await screen.findByRole('heading', { name: 'Registrá tu cuenta' })).toBeInTheDocument()
  })

  it('redirects an authenticated user from /registro to /', async () => {
    const router = renderAt('/registro')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('heading', { name: 'Registrá tu cuenta' })).not.toBeInTheDocument()
  })

  it('TC-84: sends a guest opening / to the login screen without rendering the home', async () => {
    asGuest()
    const router = renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByRole('heading', { name: 'Inicio' })).not.toBeInTheDocument()
  })

  it('renders the login screen at /login for a guest', async () => {
    asGuest()
    renderAt('/login')

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
  })

  it('redirects an authenticated user from /login to /', async () => {
    const router = renderAt('/login')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('heading', { name: 'Ingresá a tu cuenta' })).not.toBeInTheDocument()
  })

  it('renders the recovery screen at /recuperar for a guest', async () => {
    asGuest()
    renderAt('/recuperar')

    expect(await screen.findByRole('heading', { name: 'Recuperá tu contraseña' })).toBeInTheDocument()
  })

  it('opens the recovery screen from the login link', async () => {
    asGuest()
    const router = renderAt('/login')

    await userEvent.setup().click(await screen.findByRole('link', { name: '¿Olvidaste tu contraseña?' }))

    expect(await screen.findByRole('heading', { name: 'Recuperá tu contraseña' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/recuperar')
  })

  it('redirects an authenticated user from /recuperar to /', async () => {
    const router = renderAt('/recuperar')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('heading', { name: 'Recuperá tu contraseña' })).not.toBeInTheDocument()
  })

  it('renders the new password screen at /restablecer/:token for a guest', async () => {
    asGuest()
    renderAt('/restablecer/abc?email=a%40b.com')

    expect(await screen.findByRole('heading', { name: 'Definí tu nueva contraseña' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument()
  })

  it('shows the success notice on the login screen after resetting the password', async () => {
    asGuest()
    vi.mocked(resetPassword).mockResolvedValue('Tu contraseña fue actualizada. Ingresá con tu nueva contraseña.')
    const user = userEvent.setup()
    const router = renderAt('/restablecer/abc?email=a%40b.com')

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'Abcdef12')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'Abcdef12')
    await user.click(screen.getByRole('button', { name: 'GUARDAR CONTRASEÑA' }))

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('status')).toHaveTextContent('Tu contraseña fue actualizada. Ingresá con tu nueva contraseña.')
  })

  it('redirects an authenticated user from /restablecer/:token to /', async () => {
    const router = renderAt('/restablecer/abc?email=a%40b.com')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('heading', { name: 'Definí tu nueva contraseña' })).not.toBeInTheDocument()
  })

  it('renders /login without nav or footer and with a single main landmark', async () => {
    asGuest()
    renderAt('/login')
    await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })

    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('TC-05: a guest logs in from /login and lands on the home with the session user', async () => {
    asGuest()
    vi.mocked(loginUser).mockImplementation(async () => {
      asAuthenticated()
    })
    const user = userEvent.setup()
    const router = renderAt('/login')

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'Abcdef12')
    await user.click(screen.getByRole('button', { name: 'INGRESAR' }))

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  })

  it('TC-83: pressing Cerrar sesión ends the session and shows the login screen', async () => {
    vi.mocked(logoutUser).mockResolvedValue(undefined)
    const router = renderAt('/')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(logoutUser).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByRole('heading', { name: 'Inicio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('TC-84: after logging out, navigating to / shows the login screen and not the protected content', async () => {
    vi.mocked(logoutUser).mockResolvedValue(undefined)
    const router = renderAt('/')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })

    await act(() => router.navigate('/'))

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByRole('heading', { name: 'Inicio' })).not.toBeInTheDocument()
  })

  it('keeps the user on / with an alert when the logout request fails', async () => {
    vi.mocked(logoutUser).mockRejectedValue(new HttpError(500, undefined))
    const router = renderAt('/')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión. Intentá nuevamente.')
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('wraps / in the shared shell (nav and footer)', async () => {
    renderAt('/')
    await screen.findByRole('heading', { name: 'Inicio' })

    expect(screen.getByRole('banner')).toHaveTextContent('TD Autos')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2026 TD Autos. Todos los derechos reservados.')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('renders /registro without nav or footer and with a single main landmark', async () => {
    asGuest()
    renderAt('/registro')
    await screen.findByRole('heading', { name: 'Registrá tu cuenta' })

    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('redirects unknown paths to /', async () => {
    const router = renderAt('/no-existe')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})
