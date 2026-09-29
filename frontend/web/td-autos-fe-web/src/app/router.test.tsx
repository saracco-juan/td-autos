import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { routes } from './router'

// HomePage fetches the current user: keep the router tests off the network.
vi.mock('../features/auth/api', () => ({
  fetchCurrentUser: vi.fn(() => new Promise(() => {})),
  registerUser: vi.fn(),
  GOOGLE_REDIRECT_URL: 'http://localhost:8000/auth/google/redirect',
}))

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('app routes', () => {
  it('renders the home placeholder at /', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('renders the register screen at /registro', () => {
    renderAt('/registro')

    expect(screen.getByRole('heading', { name: 'Registrá tu cuenta' })).toBeInTheDocument()
  })

  it.each(['/', '/registro'])('wraps %s in the shared shell (nav and footer)', (path) => {
    renderAt(path)

    expect(screen.getByRole('banner')).toHaveTextContent('TD Autos')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2026 TD Autos. Todos los derechos reservados.')
  })

  it('redirects unknown paths to /', () => {
    const router = renderAt('/no-existe')

    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })
})
