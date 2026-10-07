import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { useAuth } from '../auth/session/useAuth'
import { fetchDiagnosis, saveDiagnosis } from './api'
import DiagnosisPage from './DiagnosisPage'
import { UNANSWERED_STEP_MESSAGE } from './diagnosisDraft'
import type { BodyType, DiagnosisAnswers, DiagnosisResponse } from './types'

vi.mock('./api', () => ({ fetchDiagnosis: vi.fn(), saveDiagnosis: vi.fn() }))
vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))

// Saving the diagnosis refreshes the session (D6): the stub records the order of the calls.
const refresh = vi.fn()

const SAVE_ERROR = 'No se pudieron guardar las respuestas. Intentá nuevamente.'

const bodyTypes: BodyType[] = [
  { id: 1, nombre: 'Sedán' },
  { id: 2, nombre: 'Hatchback' },
  { id: 3, nombre: 'SUV' },
  { id: 4, nombre: 'Pickup' },
  { id: 5, nombre: 'Furgón' },
  { id: 6, nombre: 'Rural / familiar' },
]

const savedAnswers: DiagnosisAnswers = {
  presupuesto: '15m_25m',
  uso_principal: 'ruta',
  pasajeros: '3_4',
  kilometros_mensuales: '500_1500',
  transmision: 'automatica',
  prioridad: 'seguridad',
  carrocerias: [1, 3],
}

// One option label per single-choice step, in order, and the payload they produce.
const FIRST_OPTIONS = [
  'Hasta $15.000.000',
  'Ciudad y trayectos cortos',
  '1 o 2',
  'Menos de 500 km',
  'Manual',
  'Consumo bajo',
]
const FIRST_PAYLOAD: DiagnosisAnswers = {
  presupuesto: 'hasta_15m',
  uso_principal: 'ciudad',
  pasajeros: '1_2',
  kilometros_mensuales: 'menos_500',
  transmision: 'manual',
  prioridad: 'consumo',
  carrocerias: [1, 3],
}

type UserEventInstance = ReturnType<typeof userEvent.setup>

async function renderPage(response: DiagnosisResponse = { diagnostico: null, carrocerias: bodyTypes }) {
  vi.mocked(fetchDiagnosis).mockResolvedValue(response)
  render(
    <MemoryRouter initialEntries={['/diagnostico']}>
      <Routes>
        <Route path="/diagnostico" element={<DiagnosisPage />} />
        <Route path="/recomendaciones" element={<h1>Recomendaciones</h1>} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1 })
}

const choose = (user: UserEventInstance, label: string) => user.click(screen.getByRole('radio', { name: label }))
const next = (user: UserEventInstance) => user.click(screen.getByRole('button', { name: 'CONTINUAR' }))
const back = (user: UserEventInstance) => user.click(screen.getByRole('button', { name: 'ATRÁS' }))
const finish = (user: UserEventInstance) => user.click(screen.getByRole('button', { name: 'VER RECOMENDACIONES' }))
const chip = (name: string) => screen.getByRole('button', { name })

// Answers steps 1-6 with the first option of each one and lands on step 7.
async function answerUntilLastStep(user: UserEventInstance) {
  for (const label of FIRST_OPTIONS) {
    await choose(user, label)
    await next(user)
  }
}

function summaryValue(label: string) {
  const summary = screen.getByRole('complementary', { name: 'TU DIAGNÓSTICO' })
  return within(summary).getByText(label).nextElementSibling
}

describe('DiagnosisPage', () => {
  beforeEach(() => {
    vi.mocked(fetchDiagnosis).mockReset()
    vi.mocked(saveDiagnosis).mockReset().mockResolvedValue(FIRST_PAYLOAD)
    refresh.mockReset().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: 'authenticated',
      login: vi.fn(),
      refresh,
      logout: vi.fn(),
    })
  })

  describe('loading', () => {
    it('shows a local loader and no question while the diagnosis is being read', () => {
      vi.mocked(fetchDiagnosis).mockReturnValue(new Promise(() => {}))
      render(
        <MemoryRouter>
          <DiagnosisPage />
        </MemoryRouter>,
      )

      expect(screen.getByRole('status')).toHaveTextContent('Cargando')
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'CONTINUAR' })).not.toBeInTheDocument()
    })

    it('shows the connection error state when the diagnosis cannot be reached, with no retry button', async () => {
      vi.mocked(fetchDiagnosis).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))
      render(
        <MemoryRouter>
          <DiagnosisPage />
        </MemoryRouter>,
      )

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Sin conexión con el servidor')
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'REINTENTAR' })).not.toBeInTheDocument()
    })

    it('shows the server error state when the diagnosis read fails with a 500, with no retry button', async () => {
      vi.mocked(fetchDiagnosis).mockRejectedValue(new HttpError(500, undefined))
      render(
        <MemoryRouter>
          <DiagnosisPage />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal')
      expect(screen.queryByRole('button', { name: 'REINTENTAR' })).not.toBeInTheDocument()
    })
  })

  describe('layout', () => {
    it('renders step 1: header, progress, options, summary and only CONTINUAR', async () => {
      await renderPage()

      expect(screen.getByText('DIAGNÓSTICO DE NECESIDADES')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: '¿Cuál es tu presupuesto máximo?' })).toBeInTheDocument()
      expect(
        screen.getByText('Incluí solo el valor del vehículo. Los gastos de compra los calculamos después.'),
      ).toBeInTheDocument()
      expect(screen.getByText('PASO 1 DE 7')).toBeInTheDocument()
      const progress = screen.getByRole('progressbar')
      expect(progress).toHaveAttribute('aria-valuenow', '1')
      expect(progress).toHaveAttribute('aria-valuemax', '7')
      const group = screen.getByRole('radiogroup', { name: '¿Cuál es tu presupuesto máximo?' })
      expect(within(group).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
        'Hasta $15.000.000',
        '$15.000.000 a $25.000.000',
        '$25.000.000 a $40.000.000',
        'Más de $40.000.000',
      ])
      expect(screen.getByRole('button', { name: 'CONTINUAR' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'ATRÁS' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'VER RECOMENDACIONES' })).not.toBeInTheDocument()
    })

    it('summarizes the seven answers: En curso for the current step, a dash for the others', async () => {
      await renderPage()

      expect(summaryValue('Presupuesto')).toHaveTextContent(/^En curso$/)
      for (const label of ['Uso principal', 'Pasajeros', 'Kilómetros mensuales', 'Transmisión', 'Prioridad', 'Carrocería']) {
        expect(summaryValue(label)).toHaveTextContent(/^—$/)
      }
    })

    it('shows the chosen label in the summary and moves En curso to the next step', async () => {
      const user = userEvent.setup()
      await renderPage()

      await choose(user, '$15.000.000 a $25.000.000')
      expect(summaryValue('Presupuesto')).toHaveTextContent(/^\$15\.000\.000 a \$25\.000\.000$/)
      await next(user)

      expect(summaryValue('Presupuesto')).toHaveTextContent(/^\$15\.000\.000 a \$25\.000\.000$/)
      expect(summaryValue('Uso principal')).toHaveTextContent(/^En curso$/)
    })

    it('shows ATRÁS and CONTINUAR on a middle step, and a question without subtitle', async () => {
      const user = userEvent.setup()
      await renderPage()
      for (const label of FIRST_OPTIONS.slice(0, 4)) {
        await choose(user, label)
        await next(user)
      }

      expect(screen.getByRole('heading', { level: 1, name: '¿Qué transmisión preferís?' })).toBeInTheDocument()
      expect(screen.getByText('PASO 5 DE 7')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
      expect(screen.getByRole('button', { name: 'ATRÁS' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'CONTINUAR' })).toBeInTheDocument()
    })

    it('shows the body-type chips, ATRÁS and VER RECOMENDACIONES on the last step', async () => {
      const user = userEvent.setup()
      await renderPage()
      await answerUntilLastStep(user)

      expect(screen.getByRole('heading', { level: 1, name: '¿Qué tipo de carrocería preferís?' })).toBeInTheDocument()
      expect(screen.getByText('PASO 7 DE 7')).toBeInTheDocument()
      const group = screen.getByRole('group', { name: '¿Qué tipo de carrocería preferís?' })
      expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual(
        bodyTypes.map((bodyType) => bodyType.nombre),
      )
      expect(screen.getByRole('button', { name: 'ATRÁS' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'VER RECOMENDACIONES' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'CONTINUAR' })).not.toBeInTheDocument()
      expect(summaryValue('Carrocería')).toHaveTextContent(/^En curso$/)
    })

    it('moves the focus to the question title when the step changes', async () => {
      const user = userEvent.setup()
      await renderPage()

      await choose(user, 'Hasta $15.000.000')
      await next(user)

      expect(screen.getByRole('heading', { level: 1, name: '¿Para qué vas a usar el auto principalmente?' })).toHaveFocus()
    })
  })

  describe('pre-filled answers', () => {
    it('pre-selects the saved answers on every step, starting at step 1', async () => {
      const user = userEvent.setup()
      await renderPage({ diagnostico: savedAnswers, carrocerias: bodyTypes })

      expect(screen.getByText('PASO 1 DE 7')).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: '$15.000.000 a $25.000.000' })).toBeChecked()
      expect(summaryValue('Pasajeros')).toHaveTextContent(/^3 o 4$/)
      await next(user)
      expect(screen.getByRole('radio', { name: 'Viajes por ruta' })).toBeChecked()
      await next(user)
      expect(screen.getByRole('radio', { name: '3 o 4' })).toBeChecked()
      await next(user)
      expect(screen.getByRole('radio', { name: 'Entre 500 y 1.500 km' })).toBeChecked()
      await next(user)
      expect(screen.getByRole('radio', { name: 'Automática' })).toBeChecked()
      await next(user)
      expect(screen.getByRole('radio', { name: 'Seguridad' })).toBeChecked()
      await next(user)
      expect(chip('Sedán')).toHaveAttribute('aria-pressed', 'true')
      expect(chip('SUV')).toHaveAttribute('aria-pressed', 'true')
      expect(chip('Pickup')).toHaveAttribute('aria-pressed', 'false')
      expect(summaryValue('Carrocería')).toHaveTextContent(/^Sedán, SUV$/)
    })
  })

  describe('step validation', () => {
    it('TC-13: CONTINUAR on an unanswered step does not advance and flags it', async () => {
      const user = userEvent.setup()
      await renderPage()

      await next(user)

      expect(screen.getByText('PASO 1 DE 7')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(UNANSWERED_STEP_MESSAGE)
      expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription(UNANSWERED_STEP_MESSAGE)
      expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true')
    })

    it('TC-13: choosing an option clears the message and lets the user continue', async () => {
      const user = userEvent.setup()
      await renderPage()
      await next(user)

      await choose(user, 'Hasta $15.000.000')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-invalid')
      await next(user)
      expect(screen.getByText('PASO 2 DE 7')).toBeInTheDocument()
    })

    it('does not carry the message over to the next step', async () => {
      const user = userEvent.setup()
      await renderPage()
      await next(user)
      await choose(user, 'Hasta $15.000.000')
      await next(user)

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('flags the last step when VER RECOMENDACIONES is pressed without a body type', async () => {
      const user = userEvent.setup()
      await renderPage()
      await answerUntilLastStep(user)

      await finish(user)

      expect(screen.getByRole('alert')).toHaveTextContent(UNANSWERED_STEP_MESSAGE)
      expect(screen.getByText('PASO 7 DE 7')).toBeInTheDocument()
      expect(saveDiagnosis).not.toHaveBeenCalled()
    })

    it('ignores a third body type while two are chosen, and lets the user deselect', async () => {
      const user = userEvent.setup()
      await renderPage()
      await answerUntilLastStep(user)

      await user.click(chip('Sedán'))
      await user.click(chip('Hatchback'))
      await user.click(chip('SUV'))

      expect(chip('SUV')).toHaveAttribute('aria-pressed', 'false')
      expect(summaryValue('Carrocería')).toHaveTextContent(/^Sedán, Hatchback$/)

      await user.click(chip('Sedán'))
      await user.click(chip('SUV'))

      expect(chip('Sedán')).toHaveAttribute('aria-pressed', 'false')
      expect(chip('SUV')).toHaveAttribute('aria-pressed', 'true')
      expect(summaryValue('Carrocería')).toHaveTextContent(/^Hatchback, SUV$/)
    })
  })

  describe('saving', () => {
    it('TC-12: completes the seven steps, saves the exact answers and goes to the recommendations', async () => {
      const user = userEvent.setup()
      await renderPage()
      await answerUntilLastStep(user)
      await user.click(chip('Sedán'))
      await user.click(chip('SUV'))

      await finish(user)

      expect(await screen.findByRole('heading', { level: 1, name: 'Recomendaciones' })).toBeInTheDocument()
      expect(saveDiagnosis).toHaveBeenCalledTimes(1)
      expect(saveDiagnosis).toHaveBeenCalledWith(FIRST_PAYLOAD)
    })

    it('D6: refreshes the session after the save and before leaving the questionnaire', async () => {
      const order: string[] = []
      vi.mocked(saveDiagnosis).mockImplementation(async () => {
        order.push('save')
        return FIRST_PAYLOAD
      })
      let finishRefresh!: () => void
      refresh.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            order.push('refresh')
            finishRefresh = resolve
          }),
      )
      const user = userEvent.setup()
      await renderPage()
      await answerUntilLastStep(user)
      await user.click(chip('Sedán'))

      await finish(user)

      await vi.waitFor(() => expect(order).toEqual(['save', 'refresh']))
      expect(screen.queryByRole('heading', { level: 1, name: 'Recomendaciones' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'GUARDANDO…' })).toBeDisabled()
      finishRefresh()
      expect(await screen.findByRole('heading', { level: 1, name: 'Recomendaciones' })).toBeInTheDocument()
    })

    it('D6: a failed refresh does not block the navigation', async () => {
      refresh.mockRejectedValue(new TypeError('Failed to fetch'))
      const user = userEvent.setup()
      await renderPage()
      await answerUntilLastStep(user)
      await user.click(chip('Sedán'))

      await finish(user)

      expect(await screen.findByRole('heading', { level: 1, name: 'Recomendaciones' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not refresh the session when the save fails', async () => {
      vi.mocked(saveDiagnosis).mockRejectedValueOnce(new HttpError(500, undefined))
      const user = userEvent.setup()
      await renderPage()
      await answerUntilLastStep(user)
      await user.click(chip('Sedán'))

      await finish(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_ERROR)
      expect(refresh).not.toHaveBeenCalled()
    })

    it('TC-14: going back keeps the answers, and a changed earlier answer is the one saved', async () => {
      const user = userEvent.setup()
      await renderPage()
      await choose(user, 'Hasta $15.000.000')
      await next(user)
      await choose(user, 'Ciudad y trayectos cortos')
      await next(user)
      await choose(user, '1 o 2')
      await back(user)
      await back(user)

      expect(screen.getByText('PASO 1 DE 7')).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'Hasta $15.000.000' })).toBeChecked()
      await choose(user, 'Más de $40.000.000')
      await next(user)
      expect(screen.getByRole('radio', { name: 'Ciudad y trayectos cortos' })).toBeChecked()
      await next(user)
      expect(screen.getByRole('radio', { name: '1 o 2' })).toBeChecked()
      for (const label of FIRST_OPTIONS.slice(2)) {
        await choose(user, label)
        await next(user)
      }
      await user.click(chip('Sedán'))
      await finish(user)

      expect(await screen.findByRole('heading', { level: 1, name: 'Recomendaciones' })).toBeInTheDocument()
      expect(saveDiagnosis).toHaveBeenCalledWith({
        ...FIRST_PAYLOAD,
        presupuesto: 'mas_40m',
        carrocerias: [1],
      })
    })

    it('marks the button busy and blocks a second submit while the request is in flight', async () => {
      let resolve!: (value: DiagnosisAnswers) => void
      vi.mocked(saveDiagnosis).mockReturnValue(new Promise<DiagnosisAnswers>((r) => (resolve = r)))
      const user = userEvent.setup()
      await renderPage()
      await answerUntilLastStep(user)
      await user.click(chip('Sedán'))

      await finish(user)

      const button = screen.getByRole('button', { name: 'GUARDANDO…' })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      await user.click(button)
      expect(saveDiagnosis).toHaveBeenCalledTimes(1)
      resolve(FIRST_PAYLOAD)
      expect(await screen.findByRole('heading', { level: 1, name: 'Recomendaciones' })).toBeInTheDocument()
    })

    it.each([
      ['a 500 response', new HttpError(500, { message: 'Server Error' })],
      ['a 422 response', new HttpError(422, { errors: { carrocerias: ['El tipo de carrocería elegido no es válido.'] } })],
      ['a network failure', new TypeError('Failed to fetch')],
    ])('stays on the last step with an error on %s, and a retry can succeed', async (_label, error) => {
      vi.mocked(saveDiagnosis).mockRejectedValueOnce(error)
      const user = userEvent.setup()
      await renderPage()
      await answerUntilLastStep(user)
      await user.click(chip('Sedán'))

      await finish(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_ERROR)
      expect(screen.getByText('PASO 7 DE 7')).toBeInTheDocument()
      expect(chip('Sedán')).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'VER RECOMENDACIONES' })).toBeEnabled()

      await finish(user)

      expect(await screen.findByRole('heading', { level: 1, name: 'Recomendaciones' })).toBeInTheDocument()
      expect(saveDiagnosis).toHaveBeenCalledTimes(2)
    })
  })
})
