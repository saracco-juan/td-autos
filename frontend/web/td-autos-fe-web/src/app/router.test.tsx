import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './router'

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

  it('renders the register placeholder at /registro', () => {
    renderAt('/registro')

    expect(screen.getByRole('heading', { name: 'Registro' })).toBeInTheDocument()
  })

  it('redirects unknown paths to /', () => {
    const router = renderAt('/no-existe')

    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })
})
