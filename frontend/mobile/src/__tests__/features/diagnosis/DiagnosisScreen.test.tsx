import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import * as diagnosisApi from '../../../features/diagnosis/api'
import * as recommendationsApi from '../../../features/recommendations/api'
import type { DiagnosisAnswers, DiagnosisResponse } from '@shared/diagnosis/types'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/diagnosis/api')
jest.mock('../../../features/recommendations/api')
jest.mock('../../../lib/tokenStorage')

const auth = jest.mocked(authApi)
const api = jest.mocked(diagnosisApi)
const storage = jest.mocked(tokenStorage)
const recommendations = jest.mocked(recommendationsApi)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador' }

const BODY_TYPES = [
  { id: 1, nombre: 'Sedán' },
  { id: 2, nombre: 'Hatchback' },
  { id: 3, nombre: 'SUV' },
]

const ANSWERS: DiagnosisAnswers = {
  presupuesto: '15m_25m',
  uso_principal: 'mixto',
  pasajeros: '3_4',
  kilometros_mensuales: '500_1500',
  transmision: 'automatica',
  prioridad: 'seguridad',
  carrocerias: [1, 2],
}

// The label to pick on each single-choice step to build ANSWERS.
const LABELS = [
  '$15.000.000 a $25.000.000',
  'Uso mixto',
  '3 o 4',
  'Entre 500 y 1.500 km',
  'Automática',
  'Seguridad',
]

function loaded(diagnostico: DiagnosisAnswers | null = null): DiagnosisResponse {
  return { diagnostico, carrocerias: BODY_TYPES }
}

async function open(response: Promise<DiagnosisResponse> = Promise.resolve(loaded())) {
  api.fetchDiagnosis.mockReturnValue(response)
  return renderApp('/')
}

async function openFailing(error: Error) {
  api.fetchDiagnosis.mockRejectedValue(error)
  return renderApp('/')
}

const option = (name: string) => screen.getByRole('radio', { name })
const chip = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) })
const button = (name: string) => screen.getByRole('button', { name })

async function answerSingleSteps() {
  for (const label of LABELS) {
    await fireEvent.press(await screen.findByRole('radio', { name: label }))
    await fireEvent.press(button('CONTINUAR'))
  }
  await screen.findByText('PASO 7 DE 7')
}

describe('DiagnosisScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue('tok')
    // VER RECOMENDACIONES opens the Recomendados tab, which asks for the ranking.
    recommendations.fetchRecommendations.mockReturnValue(new Promise(() => {}))
    auth.fetchCurrentUser.mockResolvedValue({ ...USER, tiene_diagnostico: false })
  })

  it('shows the first question with its options and only CONTINUAR', async () => {
    await open()

    expect(await screen.findByText('¿Cuál es tu presupuesto máximo?')).toBeOnTheScreen()
    expect(screen.getByText('DIAGNÓSTICO DE NECESIDADES')).toBeOnTheScreen()
    expect(screen.getByText('PASO 1 DE 7')).toBeOnTheScreen()
    expect(option('Hasta $15.000.000')).toBeOnTheScreen()
    expect(option('Más de $40.000.000')).toBeOnTheScreen()
    expect(button('CONTINUAR')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'ATRÁS' })).not.toBeOnTheScreen()
    expect(api.fetchDiagnosis).toHaveBeenCalledTimes(1)
  })

  it('shows a loader while the diagnosis loads', async () => {
    await open(new Promise(() => undefined))

    expect(await screen.findByLabelText('Cargando')).toBeOnTheScreen()
    expect(screen.queryByText('PASO 1 DE 7')).not.toBeOnTheScreen()
  })

  it('shows the connection error when the server cannot be reached', async () => {
    await openFailing(new NetworkError(new Error('down')))

    expect(await screen.findByText('Sin conexión con el servidor')).toBeOnTheScreen()
    expect(
      screen.getByText('No pudimos conectarnos. Revisá tu conexión a internet e intentá de nuevo.'),
    ).toBeOnTheScreen()
  })

  it('shows a generic error when the server fails', async () => {
    await openFailing(new HttpError(500, {}))

    expect(await screen.findByText('Algo salió mal')).toBeOnTheScreen()
  })

  it('pre-fills the saved answers', async () => {
    await open(Promise.resolve(loaded(ANSWERS)))

    expect(await screen.findByRole('radio', { name: LABELS[0] })).toBeChecked()
    expect(option('Hasta $15.000.000')).not.toBeChecked()
  })

  it('TC-13: CONTINUAR without an answer shows the warning and stays on the step', async () => {
    await open()
    await screen.findByText('PASO 1 DE 7')

    await fireEvent.press(button('CONTINUAR'))

    expect(await screen.findByText('Elegí una opción para continuar.')).toBeOnTheScreen()
    expect(screen.getByText('PASO 1 DE 7')).toBeOnTheScreen()

    await fireEvent.press(option('Hasta $15.000.000'))
    expect(screen.queryByText('Elegí una opción para continuar.')).not.toBeOnTheScreen()
    await fireEvent.press(button('CONTINUAR'))
    expect(await screen.findByText('PASO 2 DE 7')).toBeOnTheScreen()
  })

  it('TC-13: VER RECOMENDACIONES without a body type shows the warning and does not save', async () => {
    await open()
    await answerSingleSteps()

    await fireEvent.press(button('VER RECOMENDACIONES'))

    expect(await screen.findByText('Elegí una opción para continuar.')).toBeOnTheScreen()
    expect(api.saveDiagnosis).not.toHaveBeenCalled()
  })

  it('TC-14: ATRÁS keeps the answers and a changed answer replaces the old one', async () => {
    await open()
    await fireEvent.press(await screen.findByRole('radio', { name: 'Hasta $15.000.000' }))
    await fireEvent.press(button('CONTINUAR'))
    await fireEvent.press(await screen.findByRole('radio', { name: 'Viajes por ruta' }))

    await fireEvent.press(button('ATRÁS'))

    expect(await screen.findByText('PASO 1 DE 7')).toBeOnTheScreen()
    expect(option('Hasta $15.000.000')).toBeChecked()

    await fireEvent.press(option('Más de $40.000.000'))
    await fireEvent.press(button('CONTINUAR'))
    expect(await screen.findByRole('radio', { name: 'Viajes por ruta' })).toBeChecked()

    await fireEvent.press(button('ATRÁS'))
    expect(await screen.findByRole('radio', { name: 'Más de $40.000.000' })).toBeChecked()
    expect(option('Hasta $15.000.000')).not.toBeChecked()
  })

  it('lets at most two body types be chosen', async () => {
    await open()
    await answerSingleSteps()

    await fireEvent.press(chip('Sedán'))
    await fireEvent.press(chip('Hatchback'))
    await fireEvent.press(chip('SUV'))

    expect(chip('Sedán')).toBeChecked()
    expect(chip('Hatchback')).toBeChecked()
    expect(chip('SUV')).not.toBeChecked()
    expect(chip('SUV')).toBeDisabled()

    await fireEvent.press(chip('Sedán'))
    await fireEvent.press(chip('SUV'))
    expect(chip('SUV')).toBeChecked()
  })

  it('TC-12: saves the answers, refreshes the user and opens Recomendados', async () => {
    let finishSave: (value: DiagnosisAnswers) => void = () => undefined
    api.saveDiagnosis.mockReturnValue(new Promise((resolve) => (finishSave = resolve)))
    const view = await open()
    await answerSingleSteps()
    await fireEvent.press(chip('Sedán'))
    await fireEvent.press(chip('Hatchback'))
    auth.fetchCurrentUser.mockResolvedValue({ ...USER, tiene_diagnostico: true })

    await fireEvent.press(button('VER RECOMENDACIONES'))

    expect(await screen.findByText('GUARDANDO…')).toBeOnTheScreen()
    expect(button('VER RECOMENDACIONES')).toBeDisabled()
    expect(button('ATRÁS')).toBeDisabled()
    expect(api.saveDiagnosis).toHaveBeenCalledWith(expect.any(Function), ANSWERS)

    await act(async () => finishSave(ANSWERS))

    await waitFor(() => expect(view.getPathname()).toBe('/recomendados'))
    expect(auth.fetchCurrentUser).toHaveBeenCalledTimes(2)
  })

  it('shows the save error and stays on the last step when saving fails', async () => {
    api.saveDiagnosis.mockRejectedValue(new HttpError(500, {}))
    const view = await open()
    await answerSingleSteps()
    await fireEvent.press(chip('Sedán'))

    await fireEvent.press(button('VER RECOMENDACIONES'))

    expect(await screen.findByText('No se pudieron guardar las respuestas. Intentá nuevamente.')).toBeOnTheScreen()
    expect(button('VER RECOMENDACIONES')).toBeEnabled()
    expect(view.getPathname()).toBe('/')
  })
})
