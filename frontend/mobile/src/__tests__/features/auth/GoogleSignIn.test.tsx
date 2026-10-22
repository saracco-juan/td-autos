import * as Linking from 'expo-linking'
import { fireEvent, screen } from 'expo-router/testing-library'
import * as WebBrowser from 'expo-web-browser'
import type { WebBrowserAuthSessionResult } from 'expo-web-browser'

import * as api from '../../../features/auth/api'
import * as diagnosisApi from '../../../features/diagnosis/api'
import { API_URL } from '../../../lib/config'
import { HttpError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/diagnosis/api')
jest.mock('../../../lib/tokenStorage')
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }))
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: jest.fn() }))

const apiMock = jest.mocked(api)
const storage = jest.mocked(tokenStorage)
const browser = jest.mocked(WebBrowser)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }
const RETURN_URL = 'tdautos://auth/google'

async function openGoogle(route: '/login' | '/registro', title: string) {
  await renderApp(route)
  await screen.findByText(title)
  await fireEvent.press(screen.getByRole('button', { name: 'CONTINUAR CON GOOGLE' }))
}

describe('Continuar con Google', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(Linking.createURL).mockReturnValue(RETURN_URL)
    storage.readToken.mockResolvedValue(null)
    jest.mocked(diagnosisApi).fetchDiagnosis.mockResolvedValue({ diagnostico: null, carrocerias: [] })
  })

  it('opens the system browser on the backend redirect, telling it where to return', async () => {
    browser.openAuthSessionAsync.mockResolvedValue(({ type: 'cancel' } as WebBrowserAuthSessionResult))

    await openGoogle('/login', 'Ingresá a tu cuenta')

    expect(browser.openAuthSessionAsync).toHaveBeenCalledWith(
      `${API_URL}/auth/google/redirect?from=login&client=mobile&return_to=${encodeURIComponent(RETURN_URL)}`,
      RETURN_URL,
    )
  })

  it('tells the backend the flow started from the registration screen', async () => {
    browser.openAuthSessionAsync.mockResolvedValue(({ type: 'cancel' } as WebBrowserAuthSessionResult))

    await openGoogle('/registro', 'Registrá tu cuenta')

    expect(browser.openAuthSessionAsync).toHaveBeenCalledWith(expect.stringContaining('from=registro'), RETURN_URL)
  })

  it('TC-02: exchanges the returned code for a session and lands on the tabs', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url: `${RETURN_URL}?code=one-time` })
    apiMock.exchangeGoogleCode.mockResolvedValue({ token: 'tok', user: USER })

    await openGoogle('/login', 'Ingresá a tu cuenta')

    expect(await screen.findByText('DIAGNÓSTICO DE NECESIDADES')).toBeOnTheScreen()
    expect(apiMock.exchangeGoogleCode).toHaveBeenCalledWith('one-time')
    expect(storage.saveToken).toHaveBeenCalledWith('tok')
  })

  it('TC-02: also works from the registration screen', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url: `${RETURN_URL}?code=one-time` })
    apiMock.exchangeGoogleCode.mockResolvedValue({ token: 'tok', user: USER })

    await openGoogle('/registro', 'Registrá tu cuenta')

    expect(await screen.findByText('DIAGNÓSTICO DE NECESIDADES')).toBeOnTheScreen()
  })

  it('TC-73: shows the cancelled message when the user closes the browser', async () => {
    browser.openAuthSessionAsync.mockResolvedValue(({ type: 'dismiss' } as WebBrowserAuthSessionResult))

    await openGoogle('/login', 'Ingresá a tu cuenta')

    expect(await screen.findByText('Se canceló el ingreso con Google.')).toBeOnTheScreen()
    expect(apiMock.exchangeGoogleCode).not.toHaveBeenCalled()
  })

  it('shows the backend error returned in the url', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url: `${RETURN_URL}?error=email_in_use` })

    await openGoogle('/registro', 'Registrá tu cuenta')

    expect(await screen.findByText('El email ya está en uso.')).toBeOnTheScreen()
  })

  it('TC-73: shows the failure message when the code cannot be exchanged', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url: `${RETURN_URL}?code=used` })
    apiMock.exchangeGoogleCode.mockRejectedValue(new HttpError(422, { code: 'code_invalid' }))

    await openGoogle('/login', 'Ingresá a tu cuenta')

    expect(
      await screen.findByText('No se pudo completar el ingreso con Google. Intentá nuevamente.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Ingresá a tu cuenta')).toBeOnTheScreen()
  })

  it('shows the failure message when the browser cannot be opened', async () => {
    browser.openAuthSessionAsync.mockRejectedValue(new Error('no browser'))

    await openGoogle('/login', 'Ingresá a tu cuenta')

    expect(
      await screen.findByText('No se pudo completar el ingreso con Google. Intentá nuevamente.'),
    ).toBeOnTheScreen()
  })

  it('shows the busy label on the button while the browser is open', async () => {
    browser.openAuthSessionAsync.mockReturnValue(new Promise(() => undefined))

    await openGoogle('/login', 'Ingresá a tu cuenta')

    expect(await screen.findByText('ABRIENDO GOOGLE…')).toBeOnTheScreen()
  })
})
