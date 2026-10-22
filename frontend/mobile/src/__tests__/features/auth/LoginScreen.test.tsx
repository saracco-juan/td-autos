import { fireEvent, screen, waitFor } from 'expo-router/testing-library'

import * as api from '../../../features/auth/api'
import * as diagnosisApi from '../../../features/diagnosis/api'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/diagnosis/api')
jest.mock('../../../lib/tokenStorage')

const apiMock = jest.mocked(api)
const storage = jest.mocked(tokenStorage)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }

async function fillAndSubmit(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email)
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), password)
  await fireEvent.press(screen.getByRole('button', { name: 'INGRESAR' }))
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue(null)
    jest.mocked(diagnosisApi).fetchDiagnosis.mockResolvedValue({ diagnostico: null, carrocerias: [] })
  })

  it('shows the Figma copy: title, subtitle, fields, actions and links', async () => {
    await renderApp('/login')

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
    expect(screen.getByText('Accedé para guardar tus favoritos.')).toBeOnTheScreen()
    expect(screen.getByLabelText('Email')).toBeOnTheScreen()
    expect(screen.getByLabelText('Contraseña')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'INGRESAR' })).toBeOnTheScreen()
    expect(screen.getByText('o')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'CONTINUAR CON GOOGLE' })).toBeOnTheScreen()
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeOnTheScreen()
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeOnTheScreen()
  })

  it('TC-05: signs in with valid credentials and lands on the tabs', async () => {
    apiMock.loginWithPassword.mockResolvedValue({ token: 'tok', user: USER })
    await renderApp('/login')
    await screen.findByText('Ingresá a tu cuenta')

    await fillAndSubmit(' ana@example.com ', 'Abcdefg1')

    expect(await screen.findByText('DIAGNÓSTICO DE NECESIDADES')).toBeOnTheScreen()
    expect(apiMock.loginWithPassword).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'Abcdefg1' })
    expect(storage.saveToken).toHaveBeenCalledWith('tok')
  })

  it('validates on the client before calling the API', async () => {
    await renderApp('/login')
    await screen.findByText('Ingresá a tu cuenta')

    await fillAndSubmit('', '')

    expect(await screen.findByText('El email es obligatorio.')).toBeOnTheScreen()
    expect(screen.getByText('La contraseña es obligatoria.')).toBeOnTheScreen()
    expect(apiMock.loginWithPassword).not.toHaveBeenCalled()
  })

  it('TC-06: shows wrong credentials as a form alert, not tied to a field', async () => {
    apiMock.loginWithPassword.mockRejectedValue(
      new HttpError(422, { errors: { email: ['Usuario incorrecto, por favor intente nuevamente'] } }),
    )
    await renderApp('/login')
    await screen.findByText('Ingresá a tu cuenta')

    await fillAndSubmit('ana@example.com', 'wrong')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Usuario incorrecto, por favor intente nuevamente')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByText('Ingresá a tu cuenta')).toBeOnTheScreen()
  })

  it('shows the not_buyer refusal message from the API', async () => {
    apiMock.loginWithPassword.mockRejectedValue(
      new HttpError(403, { code: 'not_buyer', message: 'La app es solo para compradores. Si tenés una concesionaria, ingresá desde la web.' }),
    )
    await renderApp('/login')
    await screen.findByText('Ingresá a tu cuenta')

    await fillAndSubmit('dealer@example.com', 'Abcdefg1')

    expect(
      await screen.findByText('La app es solo para compradores. Si tenés una concesionaria, ingresá desde la web.'),
    ).toBeOnTheScreen()
  })

  it('shows a generic message for any other failure', async () => {
    apiMock.loginWithPassword.mockRejectedValue(new NetworkError(new Error('down')))
    await renderApp('/login')
    await screen.findByText('Ingresá a tu cuenta')

    await fillAndSubmit('ana@example.com', 'Abcdefg1')

    expect(await screen.findByText('No se pudo iniciar sesión. Intentá nuevamente.')).toBeOnTheScreen()
  })

  it('shows the busy label while signing in', async () => {
    apiMock.loginWithPassword.mockReturnValue(new Promise(() => undefined))
    await renderApp('/login')
    await screen.findByText('Ingresá a tu cuenta')

    await fillAndSubmit('ana@example.com', 'Abcdefg1')

    expect(await screen.findByText('INGRESANDO…')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'INGRESAR' })).toBeDisabled()
  })

  it('toggles the password visibility', async () => {
    await renderApp('/login')
    await screen.findByText('Ingresá a tu cuenta')
    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true)

    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar contraseña' }))

    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(false)
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeOnTheScreen()
  })

  it('links to registration and to password recovery', async () => {
    await renderApp('/login')
    await fireEvent.press(await screen.findByRole('link', { name: 'Crear cuenta' }))
    expect(await screen.findByText('Registrá tu cuenta')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('link', { name: 'Iniciar sesión' }))
    await fireEvent.press(await screen.findByRole('link', { name: '¿Olvidaste tu contraseña?' }))
    await waitFor(() => expect(screen.getByText('Recuperá tu contraseña')).toBeOnTheScreen())
  })
})
