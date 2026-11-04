import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library'
import { AccessibilityInfo } from 'react-native'

import * as authApi from '../../../features/auth/api'
import * as inspectionApi from '../../../features/inspection/api'
import { CRITICAL_CODES, STEPS, inspectionResponse } from '@shared/checklist/inspection/fixtures'
import type { InspectionProgress, InspectionResponse } from '@shared/checklist/inspection/types'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/inspection/api')
jest.mock('../../../lib/tokenStorage')

const auth = jest.mocked(authApi)
const api = jest.mocked(inspectionApi)
const storage = jest.mocked(tokenStorage)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true }
const URL = '/vehiculos/7/inspeccion'
const ALL_CODES = STEPS.flatMap((step) => step.items.map((item) => item.codigo))
const PROGRESS: InspectionProgress = { estado: 'en_curso', items_completados: [] }

const button = (name: string) => screen.getByRole('button', { name })
const checkbox = (name: RegExp) => screen.getByRole('checkbox', { name })
const tab = (name: RegExp) => screen.getByRole('tab', { name })

async function open(response: InspectionResponse = inspectionResponse()) {
  api.fetchInspection.mockResolvedValue(response)
  const view = await renderApp(URL)
  await screen.findByText('CHECKLIST DE INSPECCIÓN')
  return view
}

async function tick(name: RegExp) {
  await fireEvent.press(checkbox(name))
}

describe('InspectionScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue('tok')
    auth.fetchCurrentUser.mockResolvedValue(USER)
    api.setItemCompleted.mockResolvedValue(PROGRESS)
    api.finishInspection.mockResolvedValue({ estado: 'completa', items_completados: ALL_CODES })
  })

  it('opens from its deep link with the header, the step pills and the first step', async () => {
    const view = await open()

    expect(view.getPathname()).toBe(URL)
    expect(api.fetchInspection).toHaveBeenCalledWith(expect.any(Function), 7)
    expect(screen.getByText('Toyota Corolla XEI 2021')).toBeOnTheScreen()
    expect(screen.getByText('0 de 10 puntos revisados')).toBeOnTheScreen()
    expect(screen.getByRole('link', { name: 'Volver a la ficha' })).toBeOnTheScreen()
    expect(tab(/^1\. Papeles del auto, 0 de 2/)).toBeSelected()
    expect(tab(/^5\. Prueba de manejo, 0 de 2/)).toBeOnTheScreen()
    expect(screen.getByText('Pedile al vendedor la cédula y el título del auto.')).toBeOnTheScreen()
    expect(checkbox(/^El titular coincide con el vendedor, crítico$/)).not.toBeChecked()
    expect(button('PASO SIGUIENTE')).toBeOnTheScreen()
    expect(button('FINALIZAR')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'PASO ANTERIOR' })).not.toBeOnTheScreen()
    // The bottom navigation stays, and the screen has no tab of its own.
    expect(screen.getByRole('button', { name: /^Diagnóstico,/ })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /inspeccion/ })).not.toBeOnTheScreen()
  })

  it('TC-35: completes the checklist step by step and finishes into the summary', async () => {
    await open()

    for (const [index, step] of STEPS.entries()) {
      for (const item of step.items) await tick(new RegExp(`^${item.texto}`))
      if (index < STEPS.length - 1) await fireEvent.press(button('PASO SIGUIENTE'))
    }

    expect(api.setItemCompleted).toHaveBeenCalledTimes(10)
    expect(api.setItemCompleted).toHaveBeenCalledWith(expect.any(Function), 7, 'papeles_titular', true)
    expect(screen.getByText('10 de 10 puntos revisados')).toBeOnTheScreen()
    // Last step: no PASO SIGUIENTE.
    expect(screen.queryByRole('button', { name: 'PASO SIGUIENTE' })).not.toBeOnTheScreen()

    await fireEvent.press(button('FINALIZAR'))

    expect(await screen.findByText('Inspección completa: revisaste los 10 puntos.')).toBeOnTheScreen()
    expect(api.finishInspection).toHaveBeenCalledWith(expect.any(Function), 7)
    expect(screen.getByText('Avance por paso')).toBeOnTheScreen()
    expect(screen.getByText('Total')).toBeOnTheScreen()
    expect(screen.queryByText('Puntos pendientes')).not.toBeOnTheScreen()
    expect(button('VOLVER A LA FICHA')).toBeOnTheScreen()

    await fireEvent.press(button('SEGUIR REVISANDO'))
    expect(await screen.findByRole('tab', { name: /^1\. Papeles del auto/ })).toBeOnTheScreen()
  })

  it('TC-36: reopening keeps the marked items and opens the first step with pending items', async () => {
    await open(inspectionResponse({ estado: 'en_curso', items_completados: ['papeles_titular', 'papeles_vtv', 'exterior_pintura'] }))

    expect(screen.getByText('3 de 10 puntos revisados')).toBeOnTheScreen()
    expect(tab(/^2\. Exterior, 1 de 2/)).toBeSelected()
    expect(checkbox(/^La pintura es pareja/)).toBeChecked()
    expect(checkbox(/^Las luces funcionan/)).not.toBeChecked()

    await fireEvent.press(tab(/^1\. Papeles del auto/))
    expect(checkbox(/^El titular coincide/)).toBeChecked()
    expect(checkbox(/^La VTV está vigente/)).toBeChecked()
  })

  it('TC-37: finishing with critical items pending warns first and marks their steps', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    await open(inspectionResponse({ items_completados: ['papeles_titular', 'exterior_pintura'] }))

    await fireEvent.press(button('FINALIZAR'))

    const warning =
      'Te quedan 2 puntos críticos sin revisar. Son los que más pesan a la hora de decidir: revisalos antes de terminar.'
    expect(screen.getByText(warning)).toBeOnTheScreen()
    expect(announce).toHaveBeenCalledWith(warning)
    expect(api.finishInspection).not.toHaveBeenCalled()
    expect(button('FINALIZAR IGUAL')).toBeOnTheScreen()
    expect(button('SEGUIR REVISANDO')).toBeOnTheScreen()
    expect(tab(/^3\. Motor, 0 de 2, 1 crítico pendiente$/)).toBeOnTheScreen()
    expect(screen.getByTestId('pending-dot-5')).toBeOnTheScreen()
    expect(screen.queryByTestId('pending-dot-1')).not.toBeOnTheScreen()

    await fireEvent.press(button('SEGUIR REVISANDO'))
    expect(screen.queryByText(warning)).not.toBeOnTheScreen()
    expect(screen.queryByTestId('pending-dot-5')).not.toBeOnTheScreen()

    await fireEvent.press(button('FINALIZAR'))
    await fireEvent.press(button('FINALIZAR IGUAL'))

    expect(
      await screen.findByText('Inspección incompleta: te quedan 8 puntos sin revisar, 2 de ellos críticos.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Puntos críticos pendientes')).toBeOnTheScreen()
    expect(screen.getByText('Son los que más pesan a la hora de decidir.')).toBeOnTheScreen()
    expect(screen.getByText('No hay pérdidas de líquidos')).toBeOnTheScreen()
    expect(screen.queryByText('La VTV está vigente')).not.toBeOnTheScreen()
  })

  it('closes the warning when the last critical item is ticked', async () => {
    const pendingCritical = CRITICAL_CODES.filter((code) => code !== 'papeles_titular')
    await open(inspectionResponse({ items_completados: pendingCritical }))
    await fireEvent.press(button('FINALIZAR'))
    expect(button('FINALIZAR IGUAL')).toBeOnTheScreen()

    await tick(/^El titular coincide/)

    expect(screen.queryByRole('button', { name: 'FINALIZAR IGUAL' })).not.toBeOnTheScreen()
    expect(button('FINALIZAR')).toBeOnTheScreen()
  })

  it('lists the pending points when none is critical', async () => {
    await open(inspectionResponse({ items_completados: ALL_CODES.filter((code) => code !== 'manejo_caja') }))

    await fireEvent.press(button('FINALIZAR'))

    expect(await screen.findByText('Inspección incompleta: te queda 1 punto sin revisar.')).toBeOnTheScreen()
    expect(screen.getByText('Puntos pendientes')).toBeOnTheScreen()
    expect(screen.getByText('La caja cambia sin tirones')).toBeOnTheScreen()
  })

  it('reverts the item and shows the error in its step when the save fails', async () => {
    api.setItemCompleted.mockRejectedValue(new NetworkError(new Error('offline')))
    await open()

    await tick(/^La VTV está vigente/)

    expect(await screen.findByText('No pudimos guardar el cambio. Probá de nuevo.')).toBeOnTheScreen()
    expect(checkbox(/^La VTV está vigente/)).not.toBeChecked()
    expect(screen.getByText('0 de 10 puntos revisados')).toBeOnTheScreen()
  })

  it('shows the finish error above the bar and stays on the checklist', async () => {
    api.finishInspection.mockRejectedValue(new HttpError(500, {}))
    await open(inspectionResponse({ items_completados: ALL_CODES }))

    await fireEvent.press(button('FINALIZAR'))

    expect(await screen.findByText('No pudimos finalizar la inspección. Probá de nuevo.')).toBeOnTheScreen()
    expect(tab(/^1\. Papeles del auto/)).toBeOnTheScreen()
    expect(screen.queryByText('Avance por paso')).not.toBeOnTheScreen()
  })

  it('does not finish when a save fails while it waits', async () => {
    let fail!: (error: Error) => void
    api.setItemCompleted.mockReturnValue(new Promise((_, reject) => (fail = reject)))
    await open()

    await tick(/^La VTV está vigente/)
    await fireEvent.press(button('FINALIZAR'))
    await fireEvent.press(button('FINALIZAR IGUAL'))
    await act(async () => fail(new NetworkError(new Error('offline'))))

    expect(await screen.findByText('No pudimos guardar el cambio. Probá de nuevo.')).toBeOnTheScreen()
    expect(api.finishInspection).not.toHaveBeenCalled()
  })

  it('shows the not-found state with a link home for an unknown vehicle', async () => {
    api.fetchInspection.mockRejectedValue(new HttpError(404, {}))
    const view = await renderApp(URL)

    expect(await screen.findByText('No encontramos este vehículo.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('link', { name: 'Volver al inicio' }))
    await waitFor(() => expect(view.getPathname()).toBe('/'))
  })

  it('shows the not-found state without calling the API for an id that cannot be one', async () => {
    await renderApp('/vehiculos/abc/inspeccion')

    expect(await screen.findByText('No encontramos este vehículo.')).toBeOnTheScreen()
    expect(api.fetchInspection).not.toHaveBeenCalled()
  })

  it('shows the connection error when the checklist cannot load', async () => {
    api.fetchInspection.mockRejectedValue(new NetworkError(new Error('offline')))
    await renderApp(URL)

    expect(await screen.findByText('Sin conexión con el servidor')).toBeOnTheScreen()
  })

  it('shows the server error for any other load failure', async () => {
    api.fetchInspection.mockRejectedValue(new HttpError(500, {}))
    await renderApp(URL)

    expect(await screen.findByText('Algo salió mal')).toBeOnTheScreen()
  })

  it('opens the vehicle sheet from Volver a la ficha when there is nothing to go back to', async () => {
    const view = await open()

    await fireEvent.press(screen.getByRole('link', { name: 'Volver a la ficha' }))

    await waitFor(() => expect(view.getPathname()).toBe('/vehiculos/7'))
  })

  it('shows the total row in the progress card', async () => {
    await open(inspectionResponse({ items_completados: ALL_CODES }))
    await fireEvent.press(button('FINALIZAR'))
    await screen.findByText('Avance por paso')

    const total = screen.getByText('Total').parent
    expect(total && within(total).getByText('10 de 10')).toBeTruthy()
  })
})
