import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../lib/http'
import { fetchCurrentUser } from '../features/auth/api'
import { routes } from './router'

// The provider and HomePage both read the current user: keep the router tests off the network.
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
