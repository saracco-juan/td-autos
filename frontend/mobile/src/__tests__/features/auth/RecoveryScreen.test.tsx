import { fireEvent, screen } from 'expo-router/testing-library'

import * as api from '../../../features/auth/api'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../lib/tokenStorage')

const apiMock = jest.mocked(api)
const storage = jest.mocked(tokenStorage)

const HELPER = 'Si existe una cuenta asociada, recibirás instrucciones por email.'

async function request(email: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email)
  await fireEvent.press(screen.getByRole('button', { name: 'SOLICITAR RECUPERACIÓN' }))
}

describe('RecoveryScreen', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue(null)
    await renderApp('/recuperar')
    await screen.findByText('Recuperá tu contraseña')
  })

  it('shows the helper text and both actions', () => {
    expect(screen.getByText(HELPER)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'SOLICITAR RECUPERACIÓN' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'VOLVER AL ACCESO' })).toBeOnTheScreen()
  })

  it('validates the email on the client', async () => {
    await request('not-an-email')

    expect(await screen.findByText('Ingresá un email válido.')).toBeOnTheScreen()
    expect(apiMock.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('TC-07: shows the backend status in a success alert above the form (03b)', async () => {
    apiMock.requestPasswordReset.mockResolvedValue(HELPER)

    await request(' ana@example.com ')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(HELPER)
    expect(screen.getAllByText(HELPER)).toHaveLength(1)
    expect(apiMock.requestPasswordReset).toHaveBeenCalledWith('ana@example.com')
    expect(screen.getByLabelText('Email')).toBeOnTheScreen()
  })

  it('shows the server email error under the field', async () => {
    apiMock.requestPasswordReset.mockRejectedValue(
      new HttpError(422, { errors: { email: ['El email no es válido.'] } }),
    )

    await request('ana@example.com')

    expect(await screen.findByText('El email no es válido.')).toBeOnTheScreen()
  })

  it('shows a generic message for any other failure', async () => {
    apiMock.requestPasswordReset.mockRejectedValue(new NetworkError(new Error('down')))

    await request('ana@example.com')

    expect(await screen.findByText('No se pudo enviar la solicitud. Intentá nuevamente.')).toBeOnTheScreen()
  })

  it('shows the busy label while the request is sent', async () => {
    apiMock.requestPasswordReset.mockReturnValue(new Promise(() => undefined))

    await request('ana@example.com')

    expect(await screen.findByText('SOLICITANDO…')).toBeOnTheScreen()
  })

  it('goes back to the sign-in screen', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'VOLVER AL ACCESO' }))

    expect(await screen.findByText('Ingresá a tu cuenta')).toBeOnTheScreen()
  })
})
