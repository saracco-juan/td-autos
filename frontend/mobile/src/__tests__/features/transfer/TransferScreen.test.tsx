import * as Linking from 'expo-linking'
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library'
import { AccessibilityInfo } from 'react-native'

import * as authApi from '../../../features/auth/api'
import * as transferApi from '../../../features/transfer/api'
import { ALL_CODES, MANDATORY_CODES, transferResponse } from '@shared/checklist/transfer/fixtures'
import { SOURCE_NOTE } from '@shared/checklist/transfer/copy'
import type { TransferProgress, TransferResponse } from '@shared/checklist/transfer/types'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/transfer/api')
jest.mock('../../../lib/tokenStorage')
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), openURL: jest.fn() }))

const auth = jest.mocked(authApi)
const api = jest.mocked(transferApi)
const storage = jest.mocked(tokenStorage)
const openURL = jest.mocked(Linking.openURL)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true }
const URL = '/transferencia'
const PROGRESS: TransferProgress = { estado: 'en_curso', items_completados: [] }
const SAVE_ERROR = 'No pudimos guardar el cambio. Probá de nuevo.'

const button = (name: string) => screen.getByRole('button', { name })
const checkbox = (name: RegExp) => screen.getByRole('checkbox', { name })
const tab = (name: RegExp) => screen.getByRole('tab', { name })

async function open(response: TransferResponse = transferResponse()) {
  api.fetchTransfer.mockResolvedValue(response)
  const view = await renderApp(URL)
  await screen.findByText('TRÁMITES')
  return view
}

async function tick(name: RegExp) {
  await fireEvent.press(checkbox(name))
}

describe('TransferScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue('tok')
    auth.fetchCurrentUser.mockResolvedValue(USER)
    api.setItemCompleted.mockResolvedValue(PROGRESS)
    api.finishTransfer.mockResolvedValue({ estado: 'completa', items_completados: ALL_CODES })
    openURL.mockResolvedValue(true)
  })

  it('opens in the Transferencia tab with the header, the stage pills and the first stage', async () => {
    const view = await open()

    expect(view.getPathname()).toBe(URL)
    expect(api.fetchTransfer).toHaveBeenCalledWith(expect.any(Function))
    expect(screen.getByText('Checklist de transferencia')).toBeOnTheScreen()
    expect(screen.getByText('0 de 15 pasos completados')).toBeOnTheScreen()
    expect(screen.queryByRole('link')).not.toBeOnTheScreen()
    expect(tab(/^1\. Antes de señar, 0 de 3/)).toBeSelected()
    expect(tab(/^4\. Después de transferir, 0 de 3/)).toBeOnTheScreen()
    expect(screen.getByText('Chequeá estos puntos antes de dejar plata de seña.')).toBeOnTheScreen()
    expect(button('ETAPA SIGUIENTE')).toBeOnTheScreen()
    expect(button('FINALIZAR')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'ETAPA ANTERIOR' })).not.toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Transferencia,/ })).toBeOnTheScreen()
  })

  it('TC-38: completes the checklist stage by stage and finishes into the summary', async () => {
    await open()

    for (const stage of transferResponse().etapas) {
      for (const item of stage.items) await tick(new RegExp(`^${item.texto.replace(/[()]/g, String.raw`\$&`)}`))
      if (stage.numero < 4) await fireEvent.press(button('ETAPA SIGUIENTE'))
    }

    expect(api.setItemCompleted).toHaveBeenCalledTimes(15)
    expect(api.setItemCompleted).toHaveBeenCalledWith(expect.any(Function), 'documentacion_dni', true)
    expect(screen.getByText('15 de 15 pasos completados')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'ETAPA SIGUIENTE' })).not.toBeOnTheScreen()

    await fireEvent.press(button('FINALIZAR'))

    expect(await screen.findByText('Trámite completo: completaste los 15 pasos.')).toBeOnTheScreen()
    expect(api.finishTransfer).toHaveBeenCalledWith(expect.any(Function))
    expect(screen.getByText('Avance por etapa')).toBeOnTheScreen()
    expect(screen.getByText('Total')).toBeOnTheScreen()
    expect(screen.queryByText('Pasos pendientes')).not.toBeOnTheScreen()

    await fireEvent.press(button('VOLVER AL CHECKLIST'))
    expect(await screen.findByRole('tab', { name: /^1\. Antes de señar/ })).toBeOnTheScreen()
  })

  it('TC-39: reopening keeps the marked items and opens the first stage with pending items', async () => {
    await open(
      transferResponse({
        estado: 'en_curso',
        items_completados: ['antes_informe_dominio', 'antes_titular', 'antes_deudas', 'documentacion_dni'],
      }),
    )

    expect(screen.getByText('4 de 15 pasos completados')).toBeOnTheScreen()
    expect(tab(/^2\. Documentación, 1 de 5/)).toBeSelected()
    expect(checkbox(/^DNI del comprador/)).toBeChecked()
    expect(checkbox(/^Cédula del vehículo/)).not.toBeChecked()

    await fireEvent.press(tab(/^1\. Antes de señar/))
    expect(checkbox(/^El vendedor es el titular/)).toBeChecked()
  })

  it('TC-79: finishing with mandatory items pending warns first and marks their stages', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const pending = ['documentacion_dni', 'tramite_formulario_08']
    await open(transferResponse({ items_completados: ALL_CODES.filter((code) => !pending.includes(code)) }))

    await fireEvent.press(button('FINALIZAR'))

    const warning =
      'Te quedan 2 pasos obligatorios sin completar. El registro los exige para hacer la transferencia: completalos antes de terminar.'
    expect(screen.getByText(warning)).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith(warning)
    expect(api.finishTransfer).not.toHaveBeenCalled()
    expect(button('FINALIZAR IGUAL')).toBeOnTheScreen()
    expect(button('SEGUIR COMPLETANDO')).toBeOnTheScreen()
    expect(tab(/^2\. Documentación, 4 de 5, 1 paso obligatorio pendiente$/)).toBeOnTheScreen()
    expect(screen.getByTestId('pending-dot-3')).toBeOnTheScreen()
    expect(screen.queryByTestId('pending-dot-1')).not.toBeOnTheScreen()

    await fireEvent.press(button('SEGUIR COMPLETANDO'))
    expect(screen.queryByText(warning)).not.toBeOnTheScreen()
    expect(screen.queryByTestId('pending-dot-3')).not.toBeOnTheScreen()

    await fireEvent.press(button('FINALIZAR'))
    await fireEvent.press(button('FINALIZAR IGUAL'))

    expect(
      await screen.findByText('Trámite incompleto: te quedan 2 pasos sin completar, 2 de ellos obligatorios.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Pasos obligatorios pendientes')).toBeOnTheScreen()
    expect(screen.getByText('El registro los exige para hacer la transferencia.')).toBeOnTheScreen()
    expect(screen.getByText('Precarga del formulario 08 digital')).toBeOnTheScreen()
    expect(button('SEGUIR COMPLETANDO')).toBeOnTheScreen()
  })

  it('closes the warning when the last mandatory item is ticked', async () => {
    await open(transferResponse({ items_completados: MANDATORY_CODES.filter((code) => code !== 'documentacion_dni') }))
    await fireEvent.press(button('FINALIZAR'))
    expect(button('FINALIZAR IGUAL')).toBeOnTheScreen()

    await fireEvent.press(tab(/^2\. Documentación/))
    await tick(/^DNI del comprador/)

    expect(screen.queryByRole('button', { name: 'FINALIZAR IGUAL' })).not.toBeOnTheScreen()
    expect(button('FINALIZAR')).toBeOnTheScreen()
  })

  it('lists the pending steps when none is mandatory', async () => {
    await open(transferResponse({ items_completados: MANDATORY_CODES }))

    await fireEvent.press(button('FINALIZAR'))

    expect(await screen.findByText('Trámite incompleto: te quedan 7 pasos sin completar.')).toBeOnTheScreen()
    expect(screen.getByText('Pasos pendientes')).toBeOnTheScreen()
    expect(screen.getByText('Turno en el registro')).toBeOnTheScreen()
    expect(screen.queryByText('El registro los exige para hacer la transferencia.')).not.toBeOnTheScreen()
  })

  it('reverts the item and shows the error in its stage when the save fails', async () => {
    api.setItemCompleted.mockRejectedValue(new NetworkError(new Error('offline')))
    await open()

    await tick(/^El vendedor es el titular/)

    expect(await screen.findByText(SAVE_ERROR)).toBeOnTheScreen()
    expect(checkbox(/^El vendedor es el titular/)).not.toBeChecked()
    expect(screen.getByText('0 de 15 pasos completados')).toBeOnTheScreen()
  })

  it('shows the finish error above the bar and stays on the checklist', async () => {
    api.finishTransfer.mockRejectedValue(new HttpError(500, {}))
    await open(transferResponse({ items_completados: ALL_CODES }))

    await fireEvent.press(button('FINALIZAR'))

    expect(await screen.findByText('No pudimos finalizar el checklist. Probá de nuevo.')).toBeOnTheScreen()
    expect(tab(/^1\. Antes de señar/)).toBeOnTheScreen()
    expect(screen.queryByText('Avance por etapa')).not.toBeOnTheScreen()
  })

  it('does not finish when a save fails while it waits', async () => {
    let fail!: (error: Error) => void
    api.setItemCompleted.mockReturnValue(new Promise((_, reject) => (fail = reject)))
    await open()

    await tick(/^El vendedor es el titular/)
    await fireEvent.press(button('FINALIZAR'))
    await fireEvent.press(button('FINALIZAR IGUAL'))
    await act(async () => fail(new NetworkError(new Error('offline'))))

    expect(await screen.findByText(SAVE_ERROR)).toBeOnTheScreen()
    expect(api.finishTransfer).not.toHaveBeenCalled()
  })

  it('shows the connection error when the checklist cannot load', async () => {
    api.fetchTransfer.mockRejectedValue(new NetworkError(new Error('offline')))
    await renderApp(URL)

    expect(await screen.findByText('Sin conexión con el servidor')).toBeOnTheScreen()
  })

  it('shows the server error for any other load failure', async () => {
    api.fetchTransfer.mockRejectedValue(new HttpError(500, {}))
    await renderApp(URL)

    expect(await screen.findByText('Algo salió mal')).toBeOnTheScreen()
  })

  it('shows the sources note under the items of every stage', async () => {
    await open()

    expect(screen.getByText(SOURCE_NOTE)).toBeOnTheScreen()
    await fireEvent.press(tab(/^3\. Trámite en el registro/))
    expect(screen.getByText(SOURCE_NOTE)).toBeOnTheScreen()
  })

  it('TC-86: the advisor card opens the advisor WhatsApp chat', async () => {
    await open(transferResponse({ asesor_whatsapp: '5491155550000' }))

    expect(screen.getByText('¿Preferís que te acompañen?')).toBeOnTheScreen()
    await fireEvent.press(button('HABLAR CON UN ASESOR'))

    expect(openURL).toHaveBeenCalledWith('https://wa.me/5491155550000')
  })

  it('keeps working when the chat cannot be opened', async () => {
    openURL.mockRejectedValue(new Error('no handler'))
    await open(transferResponse({ asesor_whatsapp: '5491155550000' }))

    await fireEvent.press(button('HABLAR CON UN ASESOR'))

    await waitFor(() => expect(openURL).toHaveBeenCalled())
    expect(screen.getByText('Checklist de transferencia')).toBeOnTheScreen()
  })

  it('TC-85: hides the advisor card when no advisor is configured', async () => {
    await open(transferResponse({ asesor_whatsapp: null }))

    expect(screen.queryByText('¿Preferís que te acompañen?')).not.toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'HABLAR CON UN ASESOR' })).not.toBeOnTheScreen()
  })

  it('shows the total row in the progress card', async () => {
    await open(transferResponse({ items_completados: ALL_CODES }))
    await fireEvent.press(button('FINALIZAR'))
    await screen.findByText('Avance por etapa')

    const total = screen.getByText('Total').parent
    expect(total && within(total).getByText('15 de 15')).toBeTruthy()
  })
})
