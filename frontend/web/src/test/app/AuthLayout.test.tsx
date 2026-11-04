import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import AuthLayout from '../../app/AuthLayout'

describe('AuthLayout', () => {
  function renderAccess(entry: string) {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<h1>Login form</h1>} />
            <Route path="/registro" element={<h1>Register form</h1>} />
            <Route path="/recuperar" element={<h1>Recovery form</h1>} />
            <Route path="/registro/concesionaria" element={<h1>Dealer form</h1>} />
            <Route path="/restablecer/:token" element={<h1>Reset form</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it('switches the real route while keeping the companion panel mounted', async () => {
    const user = userEvent.setup()
    renderAccess('/login')
    expect(screen.getByRole('link', { name: 'TD Autos' })).toHaveAttribute('href', '/')
    const panel = screen.getByRole('complementary')
    expect(screen.getByRole('link', { name: 'CREAR CUENTA' })).toHaveAttribute('href', '/registro')
    await user.click(screen.getByRole('link', { name: 'CREAR CUENTA' }))
    expect(screen.getByRole('heading', { name: 'Register form' })).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toBe(panel)
    await user.click(screen.getByRole('link', { name: 'INICIAR SESIÓN' }))
    expect(screen.getByRole('heading', { name: 'Login form' })).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toBe(panel)
  })

  it('opens registration directly with an action back to login', () => {
    renderAccess('/registro')
    expect(screen.getByRole('heading', { name: 'Register form' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'INICIAR SESIÓN' })).toHaveAttribute('href', '/login')
  })

  it('switches immediately when the companion action is activated with the keyboard', async () => {
    const user = userEvent.setup()
    renderAccess('/login')
    screen.getByRole('link', { name: 'CREAR CUENTA' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'Register form' })).toBeInTheDocument()
    expect(screen.getByRole('complementary').parentElement).toHaveAttribute('data-instant', 'true')
  })

  it.each(['/recuperar', '/registro/concesionaria', '/restablecer/example-token'])(
    'keeps the standalone presentation for %s', (entry) => {
      renderAccess(entry)
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
      expect(screen.getByRole('main')).toBeInTheDocument()
    },
  )

  it('renders only the routed content inside a single main landmark', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route index element={<p>Contenido</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('main')).toHaveTextContent('Contenido')
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })
})
