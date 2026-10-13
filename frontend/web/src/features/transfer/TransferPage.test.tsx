import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { fetchTransfer, finishTransfer, setItemCompleted } from './api'
import { ALL_CODES, MANDATORY_CODES, transferResponse } from './fixtures'
import TransferPage from './TransferPage'
import type { TransferProgress, TransferResponse } from './types'

vi.mock('./api', () => ({ fetchTransfer: vi.fn(), setItemCompleted: vi.fn(), finishTransfer: vi.fn() }))

const SAVE_ERROR = 'No pudimos guardar el cambio. Probá de nuevo.'
const FINISH_ERROR = 'No pudimos finalizar el checklist. Probá de nuevo.'
const SOURCE_NOTE =
  'Guía orientativa. Fuente: Dirección Nacional de los Registros de la Propiedad del Automotor (DNRPA). Verificá los requisitos vigentes en tu registro antes de iniciar el trámite.'

// A promise the test settles by hand, to hold a request in flight.
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const saved = (codes: string[] = []): TransferProgress => ({ estado: 'en_curso', items_completados: codes })

async function renderPage(response: TransferResponse = transferResponse()) {
  vi.mocked(fetchTransfer).mockResolvedValue(response)
  render(
    <MemoryRouter initialEntries={['/transferencia']}>
      <Routes>
        <Route path="/transferencia" element={<TransferPage />} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1 })
}

type User = ReturnType<typeof userEvent.setup>

const checkbox = (name: string | RegExp) => screen.getByRole('checkbox', { name })
const button = (name: string) => screen.getByRole('button', { name })
const counter = () => screen.getByText(/pasos completados$/)
const tab = (title: string) => screen.getByRole('tab', { name: new RegExp(`^${title.replace('.', '\\.')}`) })
const selectedStage = () => Number(screen.getByRole('tab', { selected: true }).textContent?.[0])
const selectStage = (user: User, title: string) => user.click(tab(title))
const warningBox = () => screen.getByText(/sin completar/)

// jsdom has no layout: this makes `(max-width: 767px)` match, like a phone.
function stubNarrowScreen() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

// Everything is ticked except one mandatory item.
const allButOneMandatory = () => ALL_CODES.filter((code) => code !== 'documentacion_cedula')
// Every mandatory item is ticked; the optional ones are pending.
const onlyMandatory = () => transferResponse({ items_completados: MANDATORY_CODES })

describe('TransferPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(fetchTransfer).mockReset()
    vi.mocked(setItemCompleted).mockReset().mockResolvedValue(saved())
    vi.mocked(finishTransfer).mockReset().mockResolvedValue({ estado: 'completa', items_completados: [] })
  })

  describe('loading and load states', () => {
    it('shows a local loader and no checklist while the checklist is being read', () => {
      vi.mocked(fetchTransfer).mockReturnValue(new Promise(() => {}))
      render(
        <MemoryRouter>
          <TransferPage />
        </MemoryRouter>,
      )

      expect(screen.getByRole('status')).toHaveTextContent('Cargando')
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
      expect(fetchTransfer).toHaveBeenCalledTimes(1)
    })

    it('shows the connection error state when the checklist cannot be reached', async () => {
      vi.mocked(fetchTransfer).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))
      render(
        <MemoryRouter>
          <TransferPage />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión con el servidor')
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    })

    it('shows the server error state when the read fails with a 500', async () => {
      vi.mocked(fetchTransfer).mockRejectedValue(new HttpError(500, undefined))
      render(
        <MemoryRouter>
          <TransferPage />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal')
    })
  })

  describe('layout', () => {
    it('TC-38: renders the eyebrow, title and counter, with no back link', async () => {
      await renderPage()

      expect(screen.getByText('TRÁMITES')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Checklist de transferencia' })).toBeInTheDocument()
      expect(counter()).toHaveTextContent('0 de 15 pasos completados')
      expect(counter()).toHaveAttribute('aria-live', 'polite')
      expect(screen.queryByRole('link', { name: /volver/i })).not.toBeInTheDocument()
    })

    it('TC-38: renders the four stages in order, each with its progress', async () => {
      await renderPage(transferResponse({ items_completados: ['antes_titular'] }))

      expect(screen.getAllByRole('tab').map((stage) => stage.textContent)).toEqual([
        '1. Antes de señar1 de 3',
        '2. Documentación0 de 5',
        '3. Trámite en el registro0 de 4',
        '4. Después de transferir0 de 3',
      ])
    })

    it('TC-38: renders only the items of the selected stage, with OBLIGATORIO badges in the name', async () => {
      const user = userEvent.setup()
      await renderPage()
      expect(screen.getAllByRole('checkbox')).toHaveLength(3)
      expect(screen.queryByText('OBLIGATORIO')).not.toBeInTheDocument()

      await selectStage(user, '2. Documentación')

      const panel = screen.getByRole('tabpanel')
      expect(within(panel).getByRole('heading', { level: 2, name: '2. Documentación' })).toBeInTheDocument()
      expect(within(panel).getByText('Juntá estos papeles antes de ir al registro.')).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox')).toHaveLength(5)
      expect(screen.getAllByText('OBLIGATORIO')).toHaveLength(5)
      expect(checkbox('DNI del comprador y del vendedor OBLIGATORIO')).toBeInTheDocument()
      await selectStage(user, '3. Trámite en el registro')
      expect(checkbox('Turno en el registro')).toBeInTheDocument()
      expect(screen.getAllByText('OBLIGATORIO')).toHaveLength(3)
    })

    it('shows the source note under the items of every stage', async () => {
      const user = userEvent.setup()
      await renderPage()
      expect(within(screen.getByRole('tabpanel')).getByText(SOURCE_NOTE)).toBeInTheDocument()

      await selectStage(user, '4. Después de transferir')

      expect(within(screen.getByRole('tabpanel')).getByText(SOURCE_NOTE)).toBeInTheDocument()
    })

    it('TC-39: opens with the saved ticks shown and the counter in line', async () => {
      const user = userEvent.setup()
      await renderPage(
        transferResponse({ estado: 'en_curso', items_completados: ['antes_titular', 'documentacion_dni'] }),
      )

      expect(checkbox('El vendedor es el titular del auto')).toBeChecked()
      expect(checkbox('Pedí el informe de dominio del auto')).not.toBeChecked()
      await selectStage(user, '2. Documentación')
      expect(checkbox('DNI del comprador y del vendedor OBLIGATORIO')).toBeChecked()
      expect(counter()).toHaveTextContent('2 de 15 pasos completados')
    })
  })

  describe('stage selection', () => {
    it('selects stage 1 when nothing is ticked', async () => {
      await renderPage()

      expect(selectedStage()).toBe(1)
    })

    it('selects the first stage that still has pending items', async () => {
      await renderPage(
        transferResponse({ items_completados: ['antes_informe_dominio', 'antes_titular', 'antes_deudas'] }),
      )

      expect(selectedStage()).toBe(2)
    })

    it('selects stage 1 when everything is ticked', async () => {
      await renderPage(transferResponse({ items_completados: ALL_CODES }))

      expect(selectedStage()).toBe(1)
      expect(counter()).toHaveTextContent('15 de 15 pasos completados')
    })

    it('lists the stages vertically on a wide screen and horizontally on a narrow one', async () => {
      await renderPage()
      expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical')
    })

    it('lists the stages horizontally on a narrow screen', async () => {
      stubNarrowScreen()
      await renderPage()

      expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal')
    })

    it('has the previous button from the second stage on and the next one up to the penultimate', async () => {
      const user = userEvent.setup()
      await renderPage()
      expect(screen.queryByRole('button', { name: 'ETAPA ANTERIOR' })).not.toBeInTheDocument()
      expect(button('ETAPA SIGUIENTE')).toBeInTheDocument()

      await selectStage(user, '2. Documentación')
      expect(button('ETAPA ANTERIOR')).toBeInTheDocument()
      expect(button('ETAPA SIGUIENTE')).toBeInTheDocument()

      await selectStage(user, '4. Después de transferir')
      expect(button('ETAPA ANTERIOR')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'ETAPA SIGUIENTE' })).not.toBeInTheDocument()
      expect(button('FINALIZAR')).toBeInTheDocument()
    })

    it('moves between stages with ETAPA SIGUIENTE and ETAPA ANTERIOR, focusing the new stage heading', async () => {
      const user = userEvent.setup()
      await renderPage()

      await user.click(button('ETAPA SIGUIENTE'))
      expect(selectedStage()).toBe(2)
      expect(screen.getByRole('heading', { level: 2, name: '2. Documentación' })).toHaveFocus()

      await user.click(button('ETAPA ANTERIOR'))
      expect(selectedStage()).toBe(1)
      expect(screen.getByRole('heading', { level: 2, name: '1. Antes de señar' })).toHaveFocus()
    })

    it('selects the stage of a save that failed when the user already moved on', async () => {
      const user = userEvent.setup()
      await renderPage()
      const saving = deferred<TransferProgress>()
      vi.mocked(setItemCompleted).mockReturnValue(saving.promise)
      await user.click(checkbox('El vendedor es el titular del auto'))
      await selectStage(user, '4. Después de transferir')

      await act(async () => saving.reject(new HttpError(500, undefined)))

      expect(selectedStage()).toBe(1)
      expect(within(screen.getByRole('tabpanel')).getByRole('alert')).toHaveTextContent(SAVE_ERROR)
    })
  })

  describe('autosave', () => {
    it('TC-39: ticking saves the item right away and updates the counter and the stage progress', async () => {
      const user = userEvent.setup()
      await renderPage()
      vi.mocked(setItemCompleted).mockResolvedValue(saved(['antes_titular']))

      await user.click(checkbox('El vendedor es el titular del auto'))

      expect(setItemCompleted).toHaveBeenCalledTimes(1)
      expect(setItemCompleted).toHaveBeenCalledWith('antes_titular', true)
      expect(checkbox('El vendedor es el titular del auto')).toBeChecked()
      expect(counter()).toHaveTextContent('1 de 15 pasos completados')
      expect(tab('1. Antes de señar')).toHaveTextContent('1 de 3')
    })

    it('unticking saves the item with completed false', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: ['antes_titular'] }))

      await user.click(checkbox('El vendedor es el titular del auto'))

      expect(setItemCompleted).toHaveBeenCalledWith('antes_titular', false)
      expect(checkbox('El vendedor es el titular del auto')).not.toBeChecked()
      expect(counter()).toHaveTextContent('0 de 15 pasos completados')
    })

    it('shows no waiting state on the row: it ticks at once and stays clickable while saving', async () => {
      const user = userEvent.setup()
      await renderPage()
      vi.mocked(setItemCompleted).mockReturnValue(new Promise(() => {}))

      await user.click(checkbox('El vendedor es el titular del auto'))

      const row = checkbox('El vendedor es el titular del auto')
      expect(row).toBeChecked()
      expect(row).not.toHaveAttribute('aria-busy')
      expect(row).toBeEnabled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('TC-39: reverts the item and shows the error inside the stage panel when the save fails', async () => {
      const user = userEvent.setup()
      await renderPage()
      vi.mocked(setItemCompleted).mockRejectedValue(new HttpError(500, undefined))

      await user.click(checkbox('El vendedor es el titular del auto'))

      expect(await within(screen.getByRole('tabpanel')).findByRole('alert')).toHaveTextContent(SAVE_ERROR)
      expect(checkbox('El vendedor es el titular del auto')).not.toBeChecked()
      expect(counter()).toHaveTextContent('0 de 15 pasos completados')
    })

    it('reverts an untick to ticked when the save fails', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: ['antes_titular'] }))
      vi.mocked(setItemCompleted).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))

      await user.click(checkbox('El vendedor es el titular del auto'))

      expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument()
      expect(checkbox('El vendedor es el titular del auto')).toBeChecked()
    })
  })

  describe('mandatory warning', () => {
    it('TC-85: warns before finishing when mandatory items are pending, without calling the API', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: ['documentacion_dni', 'documentacion_titulo'] }))

      await user.click(button('FINALIZAR'))

      const warning = warningBox()
      expect(warning).toHaveAttribute('role', 'alert')
      expect(warning).toHaveTextContent(
        'Te quedan 6 pasos obligatorios sin completar. El registro los exige para hacer la transferencia: completalos antes de terminar.',
      )
      expect(warning).toHaveFocus()
      expect(finishTransfer).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'FINALIZAR' })).not.toBeInTheDocument()
      expect(button('FINALIZAR IGUAL')).toBeInTheDocument()
      expect(button('SEGUIR COMPLETANDO')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'ETAPA SIGUIENTE' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'ETAPA ANTERIOR' })).not.toBeInTheDocument()
    })

    it('TC-85: uses the singular when one mandatory item is pending', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: allButOneMandatory() }))

      await user.click(button('FINALIZAR'))

      expect(warningBox()).toHaveTextContent(
        'Te queda 1 paso obligatorio sin completar. El registro lo exige para hacer la transferencia: completalo antes de terminar.',
      )
    })

    it('marks the stages with mandatory items pending in the list, without switching stage', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: ['documentacion_dni', 'documentacion_titulo'] }))
      expect(screen.queryByText(/obligatorio pendiente|obligatorios pendientes/)).not.toBeInTheDocument()

      await user.click(button('FINALIZAR'))

      expect(selectedStage()).toBe(1)
      expect(tab('1. Antes de señar')).not.toHaveTextContent('pendiente')
      expect(tab('2. Documentación')).toHaveTextContent('3 pasos obligatorios pendientes')
      expect(tab('3. Trámite en el registro')).toHaveTextContent('3 pasos obligatorios pendientes')
      expect(tab('4. Después de transferir')).not.toHaveTextContent('pendiente')
    })

    it('uses the singular in the stage marker', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: allButOneMandatory() }))

      await user.click(button('FINALIZAR'))

      expect(tab('2. Documentación')).toHaveTextContent('1 paso obligatorio pendiente')
    })

    it('SEGUIR COMPLETANDO hides the warning and the markers and brings FINALIZAR and the stage buttons back', async () => {
      const user = userEvent.setup()
      await renderPage()
      await user.click(button('FINALIZAR'))

      await user.click(button('SEGUIR COMPLETANDO'))

      expect(screen.queryByText(/sin completar/)).not.toBeInTheDocument()
      expect(screen.queryByText(/pendiente/)).not.toBeInTheDocument()
      expect(button('FINALIZAR')).toBeInTheDocument()
      expect(button('ETAPA SIGUIENTE')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'FINALIZAR IGUAL' })).not.toBeInTheDocument()
      expect(finishTransfer).not.toHaveBeenCalled()
    })

    it('TC-85: FINALIZAR IGUAL finishes with mandatory items pending and shows the summary view', async () => {
      const user = userEvent.setup()
      await renderPage()
      vi.mocked(finishTransfer).mockResolvedValue({ estado: 'incompleta', items_completados: [] })
      await user.click(button('FINALIZAR'))

      await user.click(button('FINALIZAR IGUAL'))

      expect(finishTransfer).toHaveBeenCalledTimes(1)
      expect(await screen.findByRole('region', { name: 'Avance por etapa' })).toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByText(/completalos antes de terminar/)).not.toBeInTheDocument()
    })

    it('updates the warning count live and returns to FINALIZAR when no mandatory item is left', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: MANDATORY_CODES.slice(2) }))
      await user.click(button('FINALIZAR'))
      expect(warningBox()).toHaveTextContent('Te quedan 2 pasos obligatorios sin completar.')

      await selectStage(user, '2. Documentación')
      await user.click(checkbox('DNI del comprador y del vendedor OBLIGATORIO'))
      expect(warningBox()).toHaveTextContent('Te queda 1 paso obligatorio sin completar.')
      expect(tab('2. Documentación')).toHaveTextContent('1 paso obligatorio pendiente')

      await user.click(checkbox(/^Título del automotor/))

      expect(screen.queryByText(/sin completar/)).not.toBeInTheDocument()
      expect(screen.queryByText(/pendiente/)).not.toBeInTheDocument()
      expect(button('FINALIZAR')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'SEGUIR COMPLETANDO' })).not.toBeInTheDocument()
    })

    it('TC-85: no warning when only optional items are pending: FINALIZAR finishes directly', async () => {
      const user = userEvent.setup()
      await renderPage(onlyMandatory())
      vi.mocked(finishTransfer).mockResolvedValue({ estado: 'incompleta', items_completados: MANDATORY_CODES })

      await user.click(button('FINALIZAR'))

      // The summary says "sin completar" too, so the check is on the mandatory warning itself.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText(/completalos antes de terminar/)).not.toBeInTheDocument()
      expect(finishTransfer).toHaveBeenCalledTimes(1)
      expect(await screen.findByRole('region', { name: 'Avance por etapa' })).toBeInTheDocument()
    })

    it('FINALIZAR IGUAL waits for the saves in flight too', async () => {
      const user = userEvent.setup()
      await renderPage()
      await user.click(button('FINALIZAR'))
      const saving = deferred<TransferProgress>()
      vi.mocked(setItemCompleted).mockReturnValue(saving.promise)
      await user.click(checkbox('El vendedor es el titular del auto'))

      await user.click(button('FINALIZAR IGUAL'))

      expect(button('FINALIZANDO…')).toBeDisabled()
      expect(finishTransfer).not.toHaveBeenCalled()
      await act(async () => saving.resolve(saved(['antes_titular'])))
      expect(finishTransfer).toHaveBeenCalledTimes(1)
    })
  })

  describe('finish', () => {
    it('shows the finishing state on the pressed button and disables the bar while it waits', async () => {
      const user = userEvent.setup()
      await renderPage(onlyMandatory())
      const finishing = deferred<TransferProgress>()
      vi.mocked(finishTransfer).mockReturnValue(finishing.promise)

      await user.click(button('FINALIZAR'))

      const busy = button('FINALIZANDO…')
      expect(busy).toBeDisabled()
      expect(busy).toHaveAttribute('aria-busy', 'true')
      await user.click(busy)
      expect(finishTransfer).toHaveBeenCalledTimes(1)

      await act(async () => finishing.resolve({ estado: 'incompleta', items_completados: MANDATORY_CODES }))
      expect(await screen.findByRole('region', { name: 'Avance por etapa' })).toBeInTheDocument()
    })

    it('shows an error in the bar and stays on the checklist when finishing fails', async () => {
      const user = userEvent.setup()
      await renderPage(onlyMandatory())
      vi.mocked(finishTransfer).mockRejectedValue(new HttpError(500, undefined))

      await user.click(button('FINALIZAR'))

      expect(await screen.findByText(FINISH_ERROR)).toHaveAttribute('role', 'alert')
      expect(button('FINALIZAR')).toBeEnabled()
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)

      vi.mocked(finishTransfer).mockResolvedValue({ estado: 'incompleta', items_completados: MANDATORY_CODES })
      await user.click(button('FINALIZAR'))
      expect(await screen.findByRole('region', { name: 'Avance por etapa' })).toBeInTheDocument()
      expect(screen.queryByText(FINISH_ERROR)).not.toBeInTheDocument()
    })

    it('waits for the saves in flight before finishing, showing the busy state at once', async () => {
      const user = userEvent.setup()
      await renderPage(onlyMandatory())
      const saving = deferred<TransferProgress>()
      vi.mocked(setItemCompleted).mockReturnValue(saving.promise)
      await user.click(checkbox('El vendedor es el titular del auto'))

      await user.click(button('FINALIZAR'))

      expect(button('FINALIZANDO…')).toBeDisabled()
      expect(finishTransfer).not.toHaveBeenCalled()

      await act(async () => saving.resolve(saved([...MANDATORY_CODES, 'antes_titular'])))

      expect(finishTransfer).toHaveBeenCalledTimes(1)
      expect(await screen.findByRole('region', { name: 'Avance por etapa' })).toBeInTheDocument()
    })

    it('does not finish when a save fails while it waits: shows the stage error and stays on the checklist', async () => {
      const user = userEvent.setup()
      await renderPage(onlyMandatory())
      const saving = deferred<TransferProgress>()
      vi.mocked(setItemCompleted).mockReturnValue(saving.promise)
      await user.click(checkbox('El vendedor es el titular del auto'))
      await user.click(button('FINALIZAR'))

      await act(async () => saving.reject(new HttpError(500, undefined)))

      expect(finishTransfer).not.toHaveBeenCalled()
      expect(screen.getByText(SAVE_ERROR)).toBeInTheDocument()
      expect(screen.queryByText(FINISH_ERROR)).not.toBeInTheDocument()
      expect(button('FINALIZAR')).toBeEnabled()
    })
  })

  describe('summary view', () => {
    it('shows the header, the progress per stage and SEGUIR COMPLETANDO, with the title focused', async () => {
      const user = userEvent.setup()
      await renderPage(onlyMandatory())

      await user.click(button('FINALIZAR'))

      expect(await screen.findByRole('heading', { level: 1, name: 'Checklist de transferencia' })).toHaveFocus()
      expect(counter()).toHaveTextContent('8 de 15 pasos completados')
      const card = screen.getByRole('region', { name: 'Avance por etapa' })
      expect(within(card).getByText('2. Documentación')).toBeInTheDocument()
      expect(button('SEGUIR COMPLETANDO')).toBeInTheDocument()
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    })

    it('TC-79: with only optional items pending, the summary lists what is missing, without badges', async () => {
      const user = userEvent.setup()
      await renderPage(onlyMandatory())

      await user.click(button('FINALIZAR'))

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Trámite incompleto: te quedan 7 pasos sin completar.',
      )
      const card = screen.getByRole('region', { name: 'Pasos pendientes' })
      expect(within(card).getAllByRole('listitem')).toHaveLength(7)
      expect(within(card).getByText('Turno en el registro')).toBeInTheDocument()
      expect(within(card).queryByText('OBLIGATORIO')).not.toBeInTheDocument()
    })

    it('TC-85: after FINALIZAR IGUAL the summary shows the pending mandatory items', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: ['documentacion_dni', 'documentacion_titulo'] }))
      vi.mocked(finishTransfer).mockResolvedValue({ estado: 'incompleta', items_completados: [] })
      await user.click(button('FINALIZAR'))

      await user.click(button('FINALIZAR IGUAL'))

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Trámite incompleto: te quedan 13 pasos sin completar, 6 de ellos obligatorios.',
      )
      const card = screen.getByRole('region', { name: 'Pasos obligatorios pendientes' })
      expect(within(card).getAllByRole('listitem')).toHaveLength(6)
      expect(within(card).getAllByText('OBLIGATORIO')).toHaveLength(6)
      expect(button('SEGUIR COMPLETANDO')).toBeInTheDocument()
    })

    it('shows the complete variant when everything is ticked, with VOLVER AL CHECKLIST', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: ALL_CODES }))
      vi.mocked(finishTransfer).mockResolvedValue({ estado: 'completa', items_completados: ALL_CODES })

      await user.click(button('FINALIZAR'))

      expect(await screen.findByRole('status')).toHaveTextContent('Trámite completo: completaste los 15 pasos.')
      expect(screen.getAllByRole('region')).toHaveLength(1)
      await user.click(button('VOLVER AL CHECKLIST'))
      expect(screen.getAllByRole('tab')).toHaveLength(4)
    })

    it('does not show the advisor card in the summary', async () => {
      const user = userEvent.setup()
      await renderPage(transferResponse({ items_completados: MANDATORY_CODES, asesor_whatsapp: '5491155550000' }))

      await user.click(button('FINALIZAR'))

      await screen.findByRole('status')
      expect(screen.queryByText('ASESORAMIENTO')).not.toBeInTheDocument()
    })

    it('keeps the local marks after finishing instead of taking the response list', async () => {
      const user = userEvent.setup()
      await renderPage(onlyMandatory())
      vi.mocked(finishTransfer).mockResolvedValue({ estado: 'incompleta', items_completados: [] })

      await user.click(button('FINALIZAR'))

      await screen.findByRole('region', { name: 'Avance por etapa' })
      expect(counter()).toHaveTextContent('8 de 15 pasos completados')
    })

    it('SEGUIR COMPLETANDO returns to the editable checklist with the marks and the selected stage intact', async () => {
      const user = userEvent.setup()
      await renderPage(onlyMandatory())
      await selectStage(user, '3. Trámite en el registro')
      await user.click(button('FINALIZAR'))

      await user.click(await screen.findByRole('button', { name: 'SEGUIR COMPLETANDO' }))

      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
      expect(selectedStage()).toBe(3)
      expect(counter()).toHaveTextContent('8 de 15 pasos completados')
      expect(checkbox('Verificación física del auto (inscriptos desde 2001) OBLIGATORIO')).toBeChecked()
      expect(button('FINALIZAR')).toBeInTheDocument()
    })
  })

  describe('advisor card', () => {
    it('TC-86: shows the card with a WhatsApp link when an advisor is configured', async () => {
      await renderPage(transferResponse({ asesor_whatsapp: '5491155550000' }))

      const card = screen.getByRole('region', { name: '¿Preferís que te acompañen?' })
      expect(within(card).getByText('ASESORAMIENTO')).toBeInTheDocument()
      expect(
        within(card).getByText(
          'Un asesor de trámites te guía paso a paso por WhatsApp, sin costo por la consulta inicial.',
        ),
      ).toBeInTheDocument()
      const link = within(card).getByRole('link', { name: 'HABLAR CON UN ASESOR' })
      expect(link).toHaveAttribute('href', 'https://wa.me/5491155550000')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('TC-86: shows no card when no advisor is configured', async () => {
      await renderPage(transferResponse({ asesor_whatsapp: null }))

      expect(screen.queryByText('ASESORAMIENTO')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'HABLAR CON UN ASESOR' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('tab')).toHaveLength(4)
    })
  })
})
