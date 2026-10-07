import { act, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { HttpError, NetworkError } from '../lib/http'
import { fetchCurrentUser, loginUser, logoutUser, resetPassword } from '../features/auth/api'
import { fetchDiagnosis, saveDiagnosis } from '../features/diagnosis/api'
import type { DiagnosisAnswers } from '../features/diagnosis/types'
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

vi.mock('../features/diagnosis/api', () => ({ fetchDiagnosis: vi.fn(), saveDiagnosis: vi.fn() }))

const ana = {
  id: 1,
  name: 'Ana',
  apellido: null,
  email: 'ana@example.com',
  rol: 'comprador',
  perfil_completo: false,
  tiene_diagnostico: true,
}

function asGuest() {
  vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(401, undefined))
}

// A buyer who never answered the questionnaire: the home sends them to /diagnostico (D6).
function asAuthenticated(overrides: Partial<typeof ana> = {}) {
  vi.mocked(fetchCurrentUser).mockResolvedValue({ ...ana, ...overrides })
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
    vi.mocked(fetchDiagnosis).mockReset()
    vi.mocked(saveDiagnosis).mockReset()
    asAuthenticated()
  })

  it('keeps the shell on screen and loads only its content while the session is read', () => {
    vi.mocked(fetchCurrentUser).mockReturnValue(new Promise(() => {}))
    renderAt('/')

    expect(screen.getByRole('banner')).toHaveTextContent('TD Autos')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('status').parentElement).toBe(screen.getByRole('main'))
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    expect(screen.queryByRole('heading', { name: 'Inicio' })).not.toBeInTheDocument()
  })

  it('shows the connection error in the content area, with the frame visible and no redirect, when the session cannot be read', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))
    const router = renderAt('/')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Sin conexión con el servidor')
    expect(alert.parentElement).toBe(screen.getByRole('main'))
    expect(screen.getByRole('banner')).toHaveTextContent('TD Autos')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows the server error in the content area when the session read fails with a 500', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new HttpError(500, undefined))
    renderAt('/perfil')

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal')
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('shows the connection error at /login instead of the form when the session cannot be read', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))
    renderAt('/login')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Sin conexión con el servidor')
    expect(alert.parentElement).toBe(screen.getByRole('main'))
    expect(screen.queryByRole('button', { name: 'INGRESAR' })).not.toBeInTheDocument()
  })

  it('loads inside the bare auth layout while the session is read at /login', () => {
    vi.mocked(fetchCurrentUser).mockReturnValue(new Promise(() => {}))
    renderAt('/login')

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('status'))
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INGRESAR' })).not.toBeInTheDocument()
  })

  it('D6: sends a user with no diagnosis from / to the questionnaire', async () => {
    asAuthenticated({ tiene_diagnostico: false })
    vi.mocked(fetchDiagnosis).mockResolvedValue({ diagnostico: null, carrocerias: [{ id: 1, nombre: 'Sedán' }] })
    const router = renderAt('/')

    expect(await screen.findByRole('heading', { level: 1, name: '¿Cuál es tu presupuesto máximo?' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/diagnostico')
    expect(screen.queryByRole('heading', { name: 'Inicio' })).not.toBeInTheDocument()
  })

  it('D6: shows the home to a user who already has a diagnosis, without reading it', async () => {
    const router = renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(fetchDiagnosis).not.toHaveBeenCalled()
  })

  it('D6: the redirect is not a lock, /perfil stays reachable without a diagnosis', async () => {
    asAuthenticated({ tiene_diagnostico: false })
    const router = renderAt('/perfil')

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/perfil')
  })

  it('D6: /diagnostico never redirects a user who has a diagnosis', async () => {
    vi.mocked(fetchDiagnosis).mockResolvedValue({ diagnostico: null, carrocerias: [{ id: 1, nombre: 'Sedán' }] })
    const router = renderAt('/diagnostico')

    expect(await screen.findByRole('heading', { level: 1, name: '¿Cuál es tu presupuesto máximo?' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/diagnostico')
  })

  it('D6: after saving the diagnosis the session is refreshed, so the home no longer bounces to the questionnaire', async () => {
    asAuthenticated({ tiene_diagnostico: false })
    const answers: DiagnosisAnswers = {
      presupuesto: 'hasta_15m',
      uso_principal: 'ciudad',
      pasajeros: '1_2',
      kilometros_mensuales: 'menos_500',
      transmision: 'manual',
      prioridad: 'consumo',
      carrocerias: [1],
    }
    vi.mocked(fetchDiagnosis).mockResolvedValue({ diagnostico: answers, carrocerias: [{ id: 1, nombre: 'Sedán' }] })
    vi.mocked(saveDiagnosis).mockImplementation(async () => {
      asAuthenticated({ tiene_diagnostico: true })
      return answers
    })
    const user = userEvent.setup()
    const router = renderAt('/diagnostico')

    for (let step = 0; step < 6; step += 1) {
      await user.click(await screen.findByRole('button', { name: 'CONTINUAR' }))
    }
    await user.click(screen.getByRole('button', { name: 'VER RECOMENDACIONES' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Recomendaciones' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/recomendaciones')

    await act(() => router.navigate('/'))

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('D7: the diagnosis loader sits directly in the content area, so it can be centered there', async () => {
    vi.mocked(fetchDiagnosis).mockReturnValue(new Promise(() => {}))
    renderAt('/diagnostico')

    // The session loader shows first; wait for the page itself to start reading the diagnosis.
    await vi.waitFor(() => expect(fetchDiagnosis).toHaveBeenCalled())
    expect(screen.getByRole('status').parentElement).toBe(screen.getByRole('main'))
    expect(screen.getByRole('banner')).toHaveTextContent('TD Autos')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('renders the provisional recommendations page at /recomendaciones inside the shell', async () => {
    const router = renderAt('/recomendaciones')

    expect(await screen.findByRole('heading', { level: 1, name: 'Recomendaciones' })).toBeInTheDocument()
    expect(screen.getByText('Guardamos tu diagnóstico. Las recomendaciones van a estar disponibles pronto.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/recomendaciones')
    expect(screen.getByRole('banner')).toHaveTextContent('TD Autos')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('redirects a guest opening /recomendaciones to the login screen', async () => {
    asGuest()
    const router = renderAt('/recomendaciones')

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByRole('heading', { name: 'Recomendaciones' })).not.toBeInTheDocument()
  })

  it('renders the home placeholder at /', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('renders the profile screen at /perfil inside the shell for an authenticated user', async () => {
    const router = renderAt('/perfil')

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/perfil')
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    expect(screen.getByRole('banner')).toHaveTextContent('TD Autos')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('redirects a guest opening /perfil to the login screen', async () => {
    asGuest()
    const router = renderAt('/perfil')

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByRole('heading', { name: 'Perfil' })).not.toBeInTheDocument()
  })

  it('renders the diagnosis screen at /diagnostico inside the shell for an authenticated user', async () => {
    vi.mocked(fetchDiagnosis).mockResolvedValue({ diagnostico: null, carrocerias: [{ id: 1, nombre: 'Sedán' }] })
    const router = renderAt('/diagnostico')

    expect(await screen.findByRole('heading', { level: 1, name: '¿Cuál es tu presupuesto máximo?' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/diagnostico')
    expect(screen.getByText('PASO 1 DE 7')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('TD Autos')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('redirects a guest opening /diagnostico to the login screen without reading the diagnosis', async () => {
    asGuest()
    const router = renderAt('/diagnostico')

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(fetchDiagnosis).not.toHaveBeenCalled()
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
