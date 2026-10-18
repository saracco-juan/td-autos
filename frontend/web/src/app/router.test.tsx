import { act, render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { HttpError, NetworkError } from '../lib/http'
import { fetchCurrentUser, loginUser, logoutUser, registerDealer, resetPassword } from '../features/auth/api'
import { fetchDiagnosis, saveDiagnosis } from '../features/diagnosis/api'
import { fetchBodyTypes, fetchVehicle, fetchVehicles } from '../features/inventory/api'
import { VEHICULOS, vehiculo } from '../features/inventory/fixtures'
import { fetchInspection } from '../features/inspection/api'
import { inspectionResponse } from '../features/inspection/fixtures'
import { fetchDealer, fetchDealerDirectory, fetchReceipt, fetchReceiptFile } from '../features/admin/api'
import { dealerDetail, directory, receipt } from '../features/admin/fixtures'
import { fetchSubscription } from '../features/subscription/api'
import { suscripcion } from '../features/subscription/fixtures'
import { searchListings } from '../features/recommendations/api'
import { searchResponse } from '../features/recommendations/fixtures'
import { fetchTransfer } from '../features/transfer/api'
import { transferResponse } from '../features/transfer/fixtures'
import type { DiagnosisAnswers } from '../features/diagnosis/types'
import { routes } from './router'

// The session provider reads the current user: keep the router tests off the network.
vi.mock('../features/auth/api', () => ({
  fetchCurrentUser: vi.fn(),
  registerUser: vi.fn(),
  registerDealer: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  GOOGLE_REDIRECT_URL: 'http://localhost:8000/auth/google/redirect',
}))

vi.mock('../features/diagnosis/api', () => ({ fetchDiagnosis: vi.fn(), saveDiagnosis: vi.fn() }))

vi.mock('../features/inspection/api', () => ({
  fetchInspection: vi.fn(),
  setItemCompleted: vi.fn(),
  finishInspection: vi.fn(),
}))

vi.mock('../features/inventory/api', () => ({
  fetchVehicles: vi.fn(),
  deleteVehicle: vi.fn(),
  fetchVehicle: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  fetchBodyTypes: vi.fn(),
  previewImport: vi.fn(),
  confirmImport: vi.fn(),
}))

vi.mock('../features/admin/api', () => ({
  fetchDealerDirectory: vi.fn(),
  fetchDealer: vi.fn(),
  updateDealer: vi.fn(),
  fetchReceipt: vi.fn(),
  fetchReceiptFile: vi.fn(),
  approveReceipt: vi.fn(),
  rejectReceipt: vi.fn(),
}))

vi.mock('../features/recommendations/api', () => ({ searchListings: vi.fn() }))

vi.mock('../features/subscription/api', () => ({ fetchSubscription: vi.fn(), sendReceipt: vi.fn() }))

vi.mock('../features/transfer/api', () => ({
  fetchTransfer: vi.fn(),
  setItemCompleted: vi.fn(),
  finishTransfer: vi.fn(),
}))

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

const marta = {
  id: 2,
  name: 'Marta',
  apellido: 'Gómez',
  email: 'marta@autosdelsur.com',
  rol: 'concesionaria',
  perfil_completo: true,
  tiene_diagnostico: false,
}

// A dealer's responsible person (UH17); like every new account, they have no diagnosis.
function asDealer(estado_alta: string | null = 'pendiente') {
  vi.mocked(fetchCurrentUser).mockResolvedValue({
    ...marta,
    concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta },
  })
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
    vi.mocked(fetchInspection).mockReset()
    vi.mocked(fetchTransfer).mockReset()
    vi.mocked(searchListings).mockReset()
    vi.mocked(searchListings).mockResolvedValue(searchResponse())
    vi.mocked(fetchSubscription).mockReset()
    vi.mocked(fetchSubscription).mockResolvedValue(suscripcion())
    vi.mocked(fetchVehicles).mockReset()
    vi.mocked(fetchVehicles).mockResolvedValue(VEHICULOS)
    vi.mocked(fetchVehicle).mockReset()
    vi.mocked(fetchVehicle).mockResolvedValue(vehiculo())
    vi.mocked(fetchBodyTypes).mockReset()
    vi.mocked(fetchBodyTypes).mockResolvedValue([{ id: 2, nombre: 'Sedán' }])
    vi.mocked(fetchDealerDirectory).mockReset()
    vi.mocked(fetchDealerDirectory).mockResolvedValue(directory())
    vi.mocked(fetchDealer).mockReset()
    vi.mocked(fetchDealer).mockResolvedValue(dealerDetail())
    vi.mocked(fetchReceipt).mockReset()
    vi.mocked(fetchReceipt).mockResolvedValue(receipt())
    vi.mocked(fetchReceiptFile).mockReset()
    vi.mocked(fetchReceiptFile).mockReturnValue(new Promise(() => {}))
    asAuthenticated()
  })

  it('keeps the shell on screen and loads only its content while the session is read', () => {
    vi.mocked(fetchCurrentUser).mockReturnValue(new Promise(() => {}))
    renderAt('/')

    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'TD Autos' })).toBeInTheDocument()
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
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'TD Autos' })).toBeInTheDocument()
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

    expect(await screen.findByRole('heading', { level: 1, name: 'Mejores opciones para vos' })).toBeInTheDocument()
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
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'TD Autos' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('renders the recommendations page with the listings at /recomendaciones inside the shell', async () => {
    const router = renderAt('/recomendaciones')

    expect(await screen.findByRole('heading', { level: 1, name: 'Mejores opciones para vos' })).toBeInTheDocument()
    expect(await screen.findByText('Mostrando 3 vehículos')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/recomendaciones')
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'TD Autos' })).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('redirects a guest opening /recomendaciones to the login screen', async () => {
    asGuest()
    const router = renderAt('/recomendaciones')

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByRole('heading', { name: 'Mejores opciones para vos' })).not.toBeInTheDocument()
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
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'TD Autos' })).toBeInTheDocument()
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
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'TD Autos' })).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('redirects a guest opening /diagnostico to the login screen without reading the diagnosis', async () => {
    asGuest()
    const router = renderAt('/diagnostico')

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(fetchDiagnosis).not.toHaveBeenCalled()
  })

  it('renders the inspection checklist at /vehiculos/:id/inspeccion inside the shell for an authenticated user', async () => {
    vi.mocked(fetchInspection).mockResolvedValue(inspectionResponse())
    const router = renderAt('/vehiculos/7/inspeccion')

    expect(await screen.findByRole('heading', { level: 1, name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/vehiculos/7/inspeccion')
    expect(fetchInspection).toHaveBeenCalledWith(7)
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'TD Autos' })).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('redirects a guest opening /vehiculos/:id/inspeccion to the login screen without reading the inspection', async () => {
    asGuest()
    const router = renderAt('/vehiculos/7/inspeccion')

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(fetchInspection).not.toHaveBeenCalled()
  })

  it('renders the transfer checklist at /transferencia inside the shell for an authenticated user', async () => {
    vi.mocked(fetchTransfer).mockResolvedValue(transferResponse())
    const router = renderAt('/transferencia')

    expect(await screen.findByRole('heading', { level: 1, name: 'Checklist de transferencia' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/transferencia')
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'TD Autos' })).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('redirects a guest opening /transferencia to the login screen without reading the checklist', async () => {
    asGuest()
    const router = renderAt('/transferencia')

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(fetchTransfer).not.toHaveBeenCalled()
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

  it('UH17: renders the dealer registration at /registro/concesionaria for a guest, in the bare auth layout', async () => {
    asGuest()
    const router = renderAt('/registro/concesionaria')

    expect(await screen.findByRole('heading', { name: 'Registrá tu concesionaria' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/registro/concesionaria')
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('UH17: opens the dealer registration from the buyer registration link', async () => {
    asGuest()
    const router = renderAt('/registro')

    await userEvent.setup().click(await screen.findByRole('link', { name: 'Registrala' }))

    expect(await screen.findByRole('heading', { name: 'Registrá tu concesionaria' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/registro/concesionaria')
  })

  it('UH17: redirects an authenticated user from /registro/concesionaria to /', async () => {
    const router = renderAt('/registro/concesionaria')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('heading', { name: 'Registrá tu concesionaria' })).not.toBeInTheDocument()
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

    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'TD Autos' })).toBeInTheDocument()
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

  describe('dealer session (UH17)', () => {
    const statusHeading = () => screen.findByRole('heading', { level: 1, name: 'Verificación de suscripción' })
    const landingHeading = () => screen.findByRole('heading', { level: 1, name: 'Suscripción y comprobantes' })

    it('TC-46: a pending dealer sees the request status at /concesionaria inside the shell', async () => {
      asDealer()
      const router = renderAt('/concesionaria')

      expect(await statusHeading()).toBeInTheDocument()
      expect(screen.getByText('Pendiente de aprobación inicial · inventario bloqueado')).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria')
      expect(screen.getByRole('banner')).toHaveTextContent('Autos del Sur')
      expect(screen.getAllByRole('main')).toHaveLength(1)
    })

    it('TC-46: a pending dealer logs in from /login and lands on the subscription screen', async () => {
      asGuest()
      vi.mocked(loginUser).mockImplementation(async () => {
        asDealer()
      })
      const user = userEvent.setup()
      const router = renderAt('/login')

      await user.type(await screen.findByLabelText('Email'), 'marta@autosdelsur.com')
      await user.type(screen.getByLabelText('Contraseña'), 'Abcdef12')
      await user.click(screen.getByRole('button', { name: 'INGRESAR' }))

      expect(await landingHeading()).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/suscripcion')
    })

    it('TC-44: a guest registers a dealer at /registro/concesionaria and lands on the subscription screen, never on the diagnosis', async () => {
      asGuest()
      vi.mocked(registerDealer).mockReset()
      vi.mocked(registerDealer).mockImplementation(async () => {
        // The registration starts the session: the refresh that follows reads the new pending dealer.
        asDealer('pendiente')
        return { ...marta, concesionaria: { id: 5, nombre: 'Autos del Sur', estado_alta: 'pendiente' } }
      })
      const user = userEvent.setup()
      const router = renderAt('/registro/concesionaria')

      await user.type(await screen.findByLabelText('Nombre de la concesionaria'), 'Autos del Sur')
      await user.type(screen.getByLabelText('Email'), 'marta@autosdelsur.com')
      await user.type(screen.getByLabelText('Nombre del responsable'), 'Marta')
      await user.type(screen.getByLabelText('Apellido del responsable'), 'Gómez')
      await user.type(screen.getByLabelText('DNI del responsable'), '30111222')
      await user.type(screen.getByLabelText('Teléfono del responsable'), '1144445555')
      await user.type(screen.getByLabelText('Teléfono público'), '1143210000')
      await user.type(screen.getByLabelText('Dirección'), 'Av. Mitre 1234')
      await user.type(screen.getByLabelText('Localidad'), 'Avellaneda')
      await user.type(screen.getByLabelText('Provincia'), 'Buenos Aires')
      await user.type(screen.getByLabelText('Contraseña'), 'Abcdef12')
      await user.type(screen.getByLabelText('Confirmar contraseña'), 'Abcdef12')
      await user.click(screen.getByRole('button', { name: 'CREAR CUENTA' }))

      expect(await landingHeading()).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/suscripcion')
      expect(screen.getByText('Pendiente de aprobación inicial · inventario bloqueado')).toBeInTheDocument()
      expect(screen.getByRole('banner')).toHaveTextContent('Autos del Sur')
      expect(registerDealer).toHaveBeenCalledTimes(1)
      expect(fetchDiagnosis).not.toHaveBeenCalled()
      expect(screen.queryByRole('heading', { name: 'Inicio' })).not.toBeInTheDocument()
    })

    it.each([
      ['an unknown role', { rol: 'admin' }],
      ['a missing role', { rol: undefined as unknown as string }],
    ])('denies a signed-in user with %s on buyer and dealer routes, in place and without reading the diagnosis', async (_label, overrides) => {
      asAuthenticated({ ...overrides, tiene_diagnostico: false })
      const router = renderAt('/')

      expect(await screen.findByRole('alert')).toHaveTextContent('No tenés permiso para realizar esta acción.')
      expect(router.state.location.pathname).toBe('/')

      await act(() => router.navigate('/concesionaria'))

      expect(await screen.findByRole('alert')).toHaveTextContent('No tenés permiso para realizar esta acción.')
      expect(router.state.location.pathname).toBe('/concesionaria')
      expect(screen.queryByRole('heading', { name: 'Verificación de suscripción' })).not.toBeInTheDocument()
      expect(fetchDiagnosis).not.toHaveBeenCalled()
    })

    it('sends a dealer from / to /concesionaria/suscripcion, never to the diagnosis', async () => {
      asDealer()
      const router = renderAt('/')

      expect(await landingHeading()).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/suscripcion')
      expect(fetchDiagnosis).not.toHaveBeenCalled()
      expect(screen.queryByRole('heading', { name: 'Inicio' })).not.toBeInTheDocument()
    })

    it.each(['/diagnostico', '/recomendaciones', '/transferencia', '/vehiculos/7/inspeccion', '/perfil'])(
      'sends a dealer opening the buyer route %s to /concesionaria/suscripcion without loading it',
      async (path) => {
        asDealer()
        const router = renderAt(path)

        expect(await landingHeading()).toBeInTheDocument()
        expect(router.state.location.pathname).toBe('/concesionaria/suscripcion')
        expect(fetchDiagnosis).not.toHaveBeenCalled()
        expect(fetchTransfer).not.toHaveBeenCalled()
        expect(fetchInspection).not.toHaveBeenCalled()
      },
    )

    it('sends a dealer opening an unknown path or a guest-only screen to /concesionaria/suscripcion', async () => {
      asDealer()
      const router = renderAt('/no-existe')

      expect(await landingHeading()).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/suscripcion')

      await act(() => router.navigate('/registro/concesionaria'))

      expect(await landingHeading()).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/suscripcion')
    })

    it.each(['/concesionaria', '/concesionaria/inventario'])('sends a buyer opening the dealer route %s to /', async (path) => {
      const router = renderAt(path)

      expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
      expect(screen.queryByRole('heading', { name: 'Verificación de suscripción' })).not.toBeInTheDocument()
    })

    it('redirects a guest opening /concesionaria to the login screen', async () => {
      asGuest()
      const router = renderAt('/concesionaria')

      expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
    })

    it('TC-45: a pending dealer opening /concesionaria/inventario is told the inventory is blocked', async () => {
      asDealer('pendiente')
      const router = renderAt('/concesionaria/inventario')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Tu cuenta está pendiente de aprobación. Todavía no podés gestionar el inventario.',
      )
      expect(router.state.location.pathname).toBe('/concesionaria/inventario')

      await userEvent.setup().click(screen.getByRole('link', { name: 'Volver a verificación' }))

      expect(await statusHeading()).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria')
    })

    it('UH21: an active dealer opening /concesionaria/inventario sees its vehicles inside the shell', async () => {
      asDealer('activa')
      const router = renderAt('/concesionaria/inventario')

      expect(await screen.findByRole('heading', { level: 1, name: 'Inventario' })).toBeInTheDocument()
      expect(await screen.findByRole('row', { name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/inventario')
      expect(fetchVehicles).toHaveBeenCalledTimes(1)
      expect(screen.getAllByRole('main')).toHaveLength(1)
    })

    it('UH21: an active dealer reaches the load form at /concesionaria/inventario/nuevo inside the shell', async () => {
      asDealer('activa')
      const router = renderAt('/concesionaria/inventario/nuevo')

      expect(await screen.findByRole('heading', { level: 1, name: 'Cargar vehículo' })).toBeInTheDocument()
      expect(await screen.findByLabelText('Patente')).toHaveValue('')
      expect(router.state.location.pathname).toBe('/concesionaria/inventario/nuevo')
      expect(screen.getAllByRole('main')).toHaveLength(1)
    })

    it('UH22: an active dealer reaches the CSV import at /concesionaria/inventario/importar inside the shell', async () => {
      asDealer('activa')
      const router = renderAt('/concesionaria/inventario/importar')

      expect(await screen.findByRole('heading', { level: 1, name: 'Importar CSV' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/inventario/importar')
      expect(screen.getAllByRole('main')).toHaveLength(1)
    })

    it('UH22: a pending dealer opening the CSV import is blocked', async () => {
      asDealer('pendiente')
      renderAt('/concesionaria/inventario/importar')

      expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta está pendiente de aprobación.')
      expect(screen.queryByLabelText('Archivo CSV')).not.toBeInTheDocument()
    })

    it('UH21: an active dealer reaches the edit form at /concesionaria/inventario/:id/editar with the vehicle loaded', async () => {
      asDealer('activa')
      const router = renderAt('/concesionaria/inventario/1/editar')

      expect(await screen.findByRole('heading', { level: 1, name: 'Editar vehículo' })).toBeInTheDocument()
      expect(await screen.findByLabelText('Patente')).toHaveValue('AB123CD')
      expect(fetchVehicle).toHaveBeenCalledWith(1)
      expect(router.state.location.pathname).toBe('/concesionaria/inventario/1/editar')
    })

    it.each(['/concesionaria/inventario/nuevo', '/concesionaria/inventario/1/editar'])(
      'UH21: a pending dealer opening %s is blocked and nothing is loaded',
      async (path) => {
        asDealer('pendiente')
        const router = renderAt(path)

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Tu cuenta está pendiente de aprobación. Todavía no podés gestionar el inventario.',
        )
        expect(router.state.location.pathname).toBe(path)
        expect(fetchVehicle).not.toHaveBeenCalled()
        expect(fetchBodyTypes).not.toHaveBeenCalled()
        expect(screen.queryByLabelText('Patente')).not.toBeInTheDocument()
      },
    )

    it.each(['/concesionaria/inventario/nuevo', '/concesionaria/inventario/1/editar'])('UH21: a buyer opening %s is sent to /', async (path) => {
      const router = renderAt(path)

      expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
    })

    it('UH21: a pending dealer never loads the inventory', async () => {
      asDealer('pendiente')
      renderAt('/concesionaria/inventario')

      await screen.findByRole('alert')

      expect(fetchVehicles).not.toHaveBeenCalled()
    })

    it.each(['pendiente', 'activa'])('UH18: a %s dealer opens /concesionaria/suscripcion inside the shell, outside the active-dealer guard', async (estado) => {
      asDealer(estado)
      vi.mocked(fetchSubscription).mockResolvedValue(suscripcion({ estado_alta: estado as 'pendiente' | 'activa' }))
      const router = renderAt('/concesionaria/suscripcion')

      expect(await screen.findByRole('heading', { level: 1, name: 'Suscripción y comprobantes' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/suscripcion')
      expect(screen.getByRole('banner')).toHaveTextContent('Autos del Sur')
      expect(screen.getAllByRole('main')).toHaveLength(1)
    })

    it('UH18: a dealer reaches the subscription screen from the Suscripción nav link', async () => {
      asDealer('pendiente')
      const router = renderAt('/concesionaria')
      await statusHeading()

      await userEvent.setup().click(screen.getByRole('link', { name: 'Suscripción' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Suscripción y comprobantes' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/suscripcion')
    })

    it('UH18: a buyer opening /concesionaria/suscripcion is sent to / and nothing is loaded', async () => {
      const router = renderAt('/concesionaria/suscripcion')

      expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
      expect(fetchSubscription).not.toHaveBeenCalled()
    })

    it('UH18: a guest opening /concesionaria/suscripcion is sent to the login screen', async () => {
      asGuest()
      const router = renderAt('/concesionaria/suscripcion')

      expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      expect(fetchSubscription).not.toHaveBeenCalled()
    })

    it('UH21: an active dealer reaches the inventory from the Inventario nav link', async () => {
      asDealer('activa')
      const router = renderAt('/concesionaria')
      await statusHeading()

      await userEvent.setup().click(screen.getByRole('link', { name: 'Inventario' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Inventario' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/inventario')
    })
  })

  it('redirects unknown paths to /', async () => {
    const router = renderAt('/no-existe')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  describe('admin session (UH19)', () => {
    // An administrator has no diagnosis: the buyer home must never send one to the questionnaire.
    function asAdmin() {
      vi.mocked(fetchCurrentUser).mockResolvedValue({ ...ana, name: 'Laura', rol: 'administrador', tiene_diagnostico: false })
    }

    const dashboardHeading = () => screen.findByRole('heading', { level: 1, name: 'Panel de administración' })

    it('an administrator who logs in lands on /admin, not on the diagnosis', async () => {
      asGuest()
      vi.mocked(loginUser).mockImplementation(async () => {
        asAdmin()
      })
      const user = userEvent.setup()
      const router = renderAt('/login')

      await user.type(await screen.findByLabelText('Email'), 'laura@tdautos.com')
      await user.type(screen.getByLabelText('Contraseña'), 'Abcdef12')
      await user.click(screen.getByRole('button', { name: 'INGRESAR' }))

      expect(await dashboardHeading()).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin')
      expect(fetchDiagnosis).not.toHaveBeenCalled()
    })

    it.each(['/', '/diagnostico', '/perfil', '/concesionaria', '/concesionaria/suscripcion', '/concesionaria/inventario'])(
      'sends an administrator opening %s to /admin',
      async (path) => {
        asAdmin()
        const router = renderAt(path)

        expect(await dashboardHeading()).toBeInTheDocument()
        expect(router.state.location.pathname).toBe('/admin')
        expect(fetchDiagnosis).not.toHaveBeenCalled()
        expect(fetchSubscription).not.toHaveBeenCalled()
        expect(fetchVehicles).not.toHaveBeenCalled()
      },
    )

    it('renders the dealer list at /admin/concesionarias inside the shell', async () => {
      asAdmin()
      const router = renderAt('/admin/concesionarias')

      expect(await screen.findByRole('heading', { level: 1, name: 'Concesionarias' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin/concesionarias')
      expect(screen.getAllByRole('main')).toHaveLength(1)
    })

    it('opens the dealer list from the dashboard', async () => {
      asAdmin()
      const router = renderAt('/admin')

      await userEvent.setup().click(await screen.findByRole('link', { name: 'VER CONCESIONARIAS' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Concesionarias' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin/concesionarias')
    })

    it('opens the receipt review from the dealer list and comes back with the back link', async () => {
      asAdmin()
      const router = renderAt('/admin/concesionarias')
      const user = userEvent.setup()

      await user.click(await screen.findByRole('link', { name: 'Ver comprobante de Concesionaria Sur' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Revisar comprobante' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin/comprobantes/31')
      expect(fetchReceipt).toHaveBeenCalledWith(31)

      await user.click(screen.getByRole('link', { name: 'Volver a concesionarias' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Concesionarias' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin/concesionarias')
    })

    it('UH27: opens the dealer page from EDITAR in the list and comes back with CANCELAR', async () => {
      asAdmin()
      const router = renderAt('/admin/concesionarias')
      const user = userEvent.setup()

      await user.click(await screen.findByRole('link', { name: 'Editar Concesionaria Sur' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Editar concesionaria' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin/concesionarias/5')
      expect(fetchDealer).toHaveBeenCalledWith(5)
      expect(screen.getByLabelText('Nombre comercial')).toHaveValue('Concesionaria Sur')
      expect(screen.getByRole('link', { name: 'Concesionarias' })).toHaveAttribute('aria-current', 'page')

      await user.click(screen.getByRole('button', { name: 'CANCELAR' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Concesionarias' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin/concesionarias')
    })

    it('UH27: reaches the receipt review from the dealer page', async () => {
      asAdmin()
      const router = renderAt('/admin/concesionarias/5')

      await userEvent.setup().click(await screen.findByRole('link', { name: 'REVISAR' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Revisar comprobante' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin/comprobantes/31')
    })

    it.each([
      ['a buyer', () => undefined, 'Inicio'],
      ['a dealer', () => asDealer('activa'), 'Suscripción y comprobantes'],
    ])('UH27: sends %s opening a dealer page away without reading the dealer', async (_label, signIn, heading) => {
      signIn()
      const router = renderAt('/admin/concesionarias/5')

      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
      expect(router.state.location.pathname).not.toBe('/admin/concesionarias/5')
      expect(fetchDealer).not.toHaveBeenCalled()
    })

    it('redirects a guest opening a dealer page to the login screen without reading the dealer', async () => {
      asGuest()
      const router = renderAt('/admin/concesionarias/5')

      expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      expect(fetchDealer).not.toHaveBeenCalled()
    })

    it('sends a buyer opening a receipt review to / without reading the receipt', async () => {
      const router = renderAt('/admin/comprobantes/31')

      expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
      expect(fetchReceipt).not.toHaveBeenCalled()
    })

    it.each(['/admin', '/admin/concesionarias'])('sends a buyer opening %s to / without reading the dealers', async (path) => {
      const router = renderAt(path)

      expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/')
      expect(fetchDealerDirectory).not.toHaveBeenCalled()
    })

    it.each(['/admin', '/admin/concesionarias'])('sends a dealer opening %s to /concesionaria/suscripcion without reading the dealers', async (path) => {
      asDealer('activa')
      const router = renderAt(path)

      expect(await screen.findByRole('heading', { level: 1, name: 'Suscripción y comprobantes' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/concesionaria/suscripcion')
      expect(fetchDealerDirectory).not.toHaveBeenCalled()
    })

    it('redirects a guest opening /admin to the login screen', async () => {
      asGuest()
      const router = renderAt('/admin')

      expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      expect(fetchDealerDirectory).not.toHaveBeenCalled()
    })
  })
})
