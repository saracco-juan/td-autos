import { fireEvent, screen } from 'expo-router/testing-library'

import * as api from '../../../features/auth/api'
import { HttpError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../lib/tokenStorage')

const apiMock = jest.mocked(api)
const storage = jest.mocked(tokenStorage)

const USER = { id: 1, name: 'Ana Pérez', apellido: null, email: 'ana@example.com', rol: 'comprador' }

type Values = { name: string; email: string; password: string; confirmation: string }
const VALID: Values = { name: 'Ana Pérez', email: 'ana@example.com', password: 'Abcdefg1', confirmation: 'Abcdefg1' }

async function fill({ name, email, password, confirmation }: Values) {
  await fireEvent.changeText(screen.getByLabelText('Nombre completo'), name)
  await fireEvent.changeText(screen.getByLabelText('Email'), email)
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), password)
  await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), confirmation)
}

async function submit(values: Values = VALID) {
  await fill(values)
  await fireEvent.press(screen.getByRole('button', { name: 'CREAR CUENTA' }))
}

describe('RegisterScreen', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue(null)
    await renderApp('/registro')
    await screen.findByText('Registrá tu cuenta')
  })

  it('shows the Figma copy and the unmet checklist', () => {
    expect(screen.getByText('Por favor, introducí tus datos para registrarte.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'CONTINUAR CON GOOGLE' })).toBeOnTheScreen()
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeOnTheScreen()
    for (const label of ['Al menos 8 caracteres', 'Una letra mayúscula', 'Una letra minúscula', 'Un número']) {
      expect(screen.getByText(label)).toBeOnTheScreen()
      expect(screen.getByLabelText(`${label} (pendiente)`)).toBeOnTheScreen()
    }
  })

  it('TC-04: ticks each requirement live as the password is typed', async () => {
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'abcdefgh')

    expect(screen.getByLabelText('Al menos 8 caracteres (cumplido)')).toBeOnTheScreen()
    expect(screen.getByLabelText('Una letra minúscula (cumplido)')).toBeOnTheScreen()
    expect(screen.getByLabelText('Una letra mayúscula (pendiente)')).toBeOnTheScreen()
    expect(screen.getByLabelText('Un número (pendiente)')).toBeOnTheScreen()
  })

  it('TC-04: shows every unmet password rule when submitting a weak password', async () => {
    await submit({ ...VALID, password: 'abc', confirmation: 'abc' })

    expect(await screen.findByText('La contraseña debe tener al menos 8 caracteres.')).toBeOnTheScreen()
    expect(screen.getByText('La contraseña debe incluir al menos una letra mayúscula.')).toBeOnTheScreen()
    expect(screen.getByText('La contraseña debe incluir al menos un número.')).toBeOnTheScreen()
    expect(apiMock.registerWithPassword).not.toHaveBeenCalled()
  })

  it('requires the name and a matching confirmation', async () => {
    await submit({ ...VALID, name: '', confirmation: 'Otra1234' })

    expect(await screen.findByText('El nombre es obligatorio.')).toBeOnTheScreen()
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeOnTheScreen()
  })

  it('TC-01: registers, signs in and lands on the tabs', async () => {
    apiMock.registerWithPassword.mockResolvedValue({ token: 'tok', user: USER })

    await submit({ ...VALID, name: '  Ana Pérez ', email: ' ana@example.com ' })

    expect(await screen.findByText('Próximamente.')).toBeOnTheScreen()
    expect(apiMock.registerWithPassword).toHaveBeenCalledWith({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'Abcdefg1',
      passwordConfirmation: 'Abcdefg1',
    })
    expect(storage.saveToken).toHaveBeenCalledWith('tok')
  })

  it('TC-03: shows the server error under the email field', async () => {
    apiMock.registerWithPassword.mockRejectedValue(
      new HttpError(422, { errors: { email: ['El email ya está en uso.'] } }),
    )

    await submit()

    expect(await screen.findByText('El email ya está en uso.')).toBeOnTheScreen()
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen()
  })

  it('maps server password errors to the password field', async () => {
    apiMock.registerWithPassword.mockRejectedValue(
      new HttpError(422, { errors: { password: ['La contraseña debe incluir al menos un número.'] } }),
    )

    await submit()

    expect(await screen.findByText('La contraseña debe incluir al menos un número.')).toBeOnTheScreen()
  })

  it('shows a generic message when the failure has no field errors', async () => {
    apiMock.registerWithPassword.mockRejectedValue(new HttpError(500, {}))

    await submit()

    expect(await screen.findByText('No se pudo completar el registro. Intentá nuevamente.')).toBeOnTheScreen()
  })

  it('shows the busy label while the account is created', async () => {
    apiMock.registerWithPassword.mockReturnValue(new Promise(() => undefined))

    await submit()

    expect(await screen.findByText('CREANDO CUENTA…')).toBeOnTheScreen()
  })
})
