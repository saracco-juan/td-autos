import { fireEvent, screen, waitFor } from 'expo-router/testing-library'

import * as api from '../../features/auth/api'
import * as tokenStorage from '../../lib/tokenStorage'
import { renderApp } from '../../test-utils/renderApp'

jest.mock('../../features/auth/api')
jest.mock('../../lib/tokenStorage')

const apiMock = jest.mocked(api)
const storage = jest.mocked(tokenStorage)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }

describe('route guards', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue(null)
  })

  it('sends a guest to the login screen', async () => {
    const view = await renderApp('/')

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/login')
  })

  it('TC-84: a guest cannot open a protected tab', async () => {
    const view = await renderApp('/perfil')

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/login')
    expect(screen.queryByText('CERRAR SESIÓN')).not.toBeOnTheScreen()
  })

  it('lands a signed-in user on the first tab with the five tabs in the bar', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)

    const view = await renderApp('/')

    expect(await screen.findByText('Próximamente.')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/')
    for (const label of ['Diagnóstico', 'Recomendados', 'Favoritos', 'Transferencia', 'Perfil']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label},`) })).toBeOnTheScreen()
    }
  })

  it('does not 404 when the OS opens the app on the google return route', async () => {
    const guest = await renderApp('/auth/google?code=abc')

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    expect(guest.getPathname()).toBe('/login')
  })

  it('sends a signed-in user from the google return route to the tabs', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)

    const view = await renderApp('/auth/google')

    expect(await screen.findByText('Próximamente.')).toBeOnTheScreen()
    expect(view.getPathname()).toBe('/')
  })

  it('TC-83 + TC-84: logging out from Perfil returns to the login and closes the tabs', async () => {
    storage.readToken.mockResolvedValue('tok')
    apiMock.fetchCurrentUser.mockResolvedValue(USER)
    apiMock.logoutRequest.mockResolvedValue(undefined)

    const view = await renderApp('/perfil')
    await fireEvent.press(await screen.findByText('CERRAR SESIÓN'))

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    await waitFor(() => expect(view.getPathname()).toBe('/login'))
    expect(screen.queryByText('CERRAR SESIÓN')).not.toBeOnTheScreen()
    expect(storage.clearToken).toHaveBeenCalled()
  })
})
