import { renderRouter, screen, waitFor, fireEvent } from 'expo-router/testing-library'

import * as api from '../../features/auth/api'
import * as tokenStorage from '../../lib/tokenStorage'

jest.mock('../../features/auth/api')
jest.mock('../../lib/tokenStorage')

const apiMock = jest.mocked(api)
const storage = jest.mocked(tokenStorage)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }
const APP_DIR = './src/app'

describe('route guards', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue(null)
  })

  it('sends a guest to the login screen', async () => {
    const view = renderRouter(APP_DIR, { initialUrl: '/' })
    await view

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/login')
  })

  it('TC-84: a guest cannot open a protected tab', async () => {
    const view = renderRouter(APP_DIR, { initialUrl: '/perfil' })
    await view

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/login')
    expect(screen.queryByText('CERRAR SESIÓN')).not.toBeOnTheScreen()
  })

  it('lands a signed-in user on the first tab with the five tabs in the bar', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)

    const view = renderRouter(APP_DIR, { initialUrl: '/' })
    await view

    expect(await screen.findByText('Próximamente.')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/')
    for (const label of ['Diagnóstico', 'Recomendados', 'Favoritos', 'Transferencia', 'Perfil']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label},`) })).toBeOnTheScreen()
    }
  })

  it('TC-83 + TC-84: logging out from Perfil returns to the login and closes the tabs', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)
    apiMock.logoutRequest.mockResolvedValue(undefined)

    const view = renderRouter(APP_DIR, { initialUrl: '/perfil' })
    await view
    await fireEvent.press(await screen.findByText('CERRAR SESIÓN'))

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    await waitFor(() => expect(view.getPathname()).toBe('/login'))
    expect(screen.queryByText('CERRAR SESIÓN')).not.toBeOnTheScreen()
    expect(storage.clearToken).toHaveBeenCalled()
  })
})
