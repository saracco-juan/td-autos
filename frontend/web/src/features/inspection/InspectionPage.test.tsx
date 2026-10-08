import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { fetchInspection, finishInspection, setItemCompleted } from './api'
import { CRITICAL_CODES, inspectionResponse } from './fixtures'
import InspectionPage from './InspectionPage'
import type { InspectionProgress, InspectionResponse } from './types'

vi.mock('./api', () => ({ fetchInspection: vi.fn(), setItemCompleted: vi.fn(), finishInspection: vi.fn() }))

const SAVE_ERROR = 'No pudimos guardar el cambio. Probá de nuevo.'
const FINISH_ERROR = 'No pudimos finalizar la inspección. Probá de nuevo.'

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

const saved = (codes: string[] = []): InspectionProgress => ({ estado: 'en_curso', items_completados: codes })

function mount(path = '/vehiculos/7/inspeccion') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/vehiculos/:id/inspeccion" element={<InspectionPage />} />
        <Route path="/" element={<h1>Inicio</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function renderPage(response: InspectionResponse = inspectionResponse()) {
  vi.mocked(fetchInspection).mockResolvedValue(response)
  mount()
  await screen.findByRole('heading', { level: 1 })
}

type User = ReturnType<typeof userEvent.setup>

const checkbox = (name: string | RegExp) => screen.getByRole('checkbox', { name })
const button = (name: string) => screen.getByRole('button', { name })
const counter = () => screen.getByText(/puntos revisados$/)
const stepHeaders = () => screen.getAllByRole('button', { name: /^\d\. / })
const stepHeader = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title.replace('.', '\\.')}`) })
// Numbers of the steps that are expanded, in order.
const openSteps = () =>
  stepHeaders()
    .filter((header) => header.getAttribute('aria-expanded') === 'true')
    .map((header) => Number(header.textContent?.[0]))

// Opens every collapsed step, so any item can be reached.
async function expandAll(user: User) {
  for (const header of stepHeaders()) {
    if (header.getAttribute('aria-expanded') === 'false') await user.click(header)
  }
}

describe('InspectionPage', () => {
  beforeEach(() => {
    vi.mocked(fetchInspection).mockReset()
    vi.mocked(setItemCompleted).mockReset().mockResolvedValue(saved())
    vi.mocked(finishInspection).mockReset().mockResolvedValue({ estado: 'completa', items_completados: [] })
  })

  describe('loading and load states', () => {
    it('shows a local loader and no checklist while the inspection is being read', () => {
      vi.mocked(fetchInspection).mockReturnValue(new Promise(() => {}))
      mount()

      expect(screen.getByRole('status')).toHaveTextContent('Cargando')
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
      expect(fetchInspection).toHaveBeenCalledWith(7)
    })

    it('shows the connection error state when the inspection cannot be reached', async () => {
      vi.mocked(fetchInspection).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))
      mount()

      expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión con el servidor')
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    })

    it('shows the server error state when the read fails with a 500', async () => {
      vi.mocked(fetchInspection).mockRejectedValue(new HttpError(500, undefined))
      mount()

      expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal')
    })

    it('shows the not-found state, with a link home, when the vehicle does not exist (404)', async () => {
      vi.mocked(fetchInspection).mockRejectedValue(new HttpError(404, undefined))
      mount()

      expect(await screen.findByText('No encontramos este vehículo.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it.each(['abc', '0', '-3', '12abc', '1.5'])(
      'shows the not-found state without calling the API when the id is %s',
      (id) => {
        mount(`/vehiculos/${id}/inspeccion`)

        expect(screen.getByText('No encontramos este vehículo.')).toBeInTheDocument()
        expect(fetchInspection).not.toHaveBeenCalled()
      },
    )
  })

  describe('layout', () => {
    it('renders the back link, eyebrow, vehicle title and counter', async () => {
      await renderPage()

      // The vehicle sheet (HU09) does not exist yet: the link points to its planned route.
      expect(screen.getByRole('link', { name: 'Volver a la ficha' })).toHaveAttribute('href', '/vehiculos/7')
      expect(screen.getByText('CHECKLIST DE INSPECCIÓN')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
      expect(counter()).toHaveTextContent('0 de 10 puntos revisados')
      expect(counter()).toHaveAttribute('aria-live', 'polite')
    })

    it('renders the five steps in order, each with its progress', async () => {
      await renderPage(inspectionResponse({ items_completados: ['papeles_vtv'] }))

      const headers = stepHeaders()
      expect(headers).toHaveLength(5)
      expect(headers.map((header) => header.textContent)).toEqual([
        '1. Papeles del auto1 de 2',
        '2. Exterior0 de 2',
        '3. Motor0 de 2',
        '4. Interior0 de 2',
        '5. Prueba de manejo0 de 2',
      ])
    })

    it('shows the hint and the items of an open step', async () => {
      const user = userEvent.setup()
      await renderPage()

      expect(screen.getByText('Pedile al vendedor la cédula y el título del auto.')).toBeInTheDocument()
      const step = screen.getByRole('region', { name: '1. Papeles del auto' })
      expect(within(step).getAllByRole('checkbox')).toHaveLength(2)
      await expandAll(user)
      expect(screen.getAllByRole('checkbox')).toHaveLength(10)
    })

    it('marks the critical items with a CRÍTICO badge that is part of the item name', async () => {
      const user = userEvent.setup()
      await renderPage()
      await expandAll(user)

      expect(screen.getAllByText('CRÍTICO')).toHaveLength(CRITICAL_CODES.length)
      expect(checkbox('El titular coincide con el vendedor CRÍTICO')).toBeInTheDocument()
      expect(checkbox('La VTV está vigente')).toBeInTheDocument()
    })

    it('TC-36: opens with the saved marks ticked and the counter in line', async () => {
      const user = userEvent.setup()
      await renderPage(
        inspectionResponse({ estado: 'en_curso', items_completados: ['papeles_vtv', 'motor_perdidas'] }),
      )
      await expandAll(user)

      expect(checkbox('La VTV está vigente')).toBeChecked()
      expect(checkbox('No hay pérdidas de líquidos CRÍTICO')).toBeChecked()
      expect(checkbox('Las luces funcionan')).not.toBeChecked()
      expect(counter()).toHaveTextContent('2 de 10 puntos revisados')
    })
  })

  describe('accordion', () => {
    it('opens only the first step when nothing is ticked', async () => {
      await renderPage()

      expect(openSteps()).toEqual([1])
    })

    it('opens only the first step that still has pending items', async () => {
      await renderPage(
        inspectionResponse({ items_completados: ['papeles_titular', 'papeles_vtv', 'exterior_pintura'] }),
      )

      expect(openSteps()).toEqual([2])
    })

    it('collapses every step when everything is ticked', async () => {
      await renderPage(
        inspectionResponse({
          items_completados: [
            'papeles_titular',
            'papeles_vtv',
            'exterior_pintura',
            'exterior_luces',
            'motor_perdidas',
            'motor_aceite',
            'interior_testigos',
            'interior_kilometraje',
            'manejo_frenos',
            'manejo_caja',
          ],
        }),
      )

      expect(openSteps()).toEqual([])
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(counter()).toHaveTextContent('10 de 10 puntos revisados')
    })

    it('opens and closes a step from its header, with aria-expanded and aria-controls', async () => {
      const user = userEvent.setup()
      await renderPage()
      const header = stepHeader('2. Exterior')
      expect(header).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('checkbox', { name: 'Las luces funcionan' })).not.toBeInTheDocument()

      await user.click(header)

      expect(header).toHaveAttribute('aria-expanded', 'true')
      const panel = document.getElementById(header.getAttribute('aria-controls') ?? '')
      expect(panel).toContainElement(checkbox('Las luces funcionan'))

      await user.click(header)

      expect(header).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('checkbox', { name: 'Las luces funcionan' })).not.toBeInTheDocument()
    })

    it('toggles with the keyboard (Enter and Space) and keeps several steps open at once', async () => {
      const user = userEvent.setup()
      await renderPage()

      stepHeader('2. Exterior').focus()
      await user.keyboard('{Enter}')
      stepHeader('3. Motor').focus()
      await user.keyboard(' ')

      expect(openSteps()).toEqual([1, 2, 3])
    })

    it('keeps the items of a collapsed step out of the tab order', async () => {
      const user = userEvent.setup()
      await renderPage()
      await user.click(stepHeader('1. Papeles del auto'))

      // The focus stays on the header that was clicked; the next stop is the following header.
      await user.tab()

      expect(document.activeElement).toBe(stepHeader('2. Exterior'))
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('updates the progress of a step when an item is ticked', async () => {
      const user = userEvent.setup()
      await renderPage()
      expect(stepHeader('1. Papeles del auto')).toHaveTextContent('0 de 2')
      vi.mocked(setItemCompleted).mockResolvedValue(saved(['papeles_vtv']))

      await user.click(checkbox('La VTV está vigente'))

      expect(stepHeader('1. Papeles del auto')).toHaveTextContent('1 de 2')
      expect(stepHeader('2. Exterior')).toHaveTextContent('0 de 2')
    })

    it('expands the step of a save that failed, even if the user closed it meanwhile', async () => {
      const user = userEvent.setup()
      await renderPage()
      const saving = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValue(saving.promise)
      await user.click(checkbox('La VTV está vigente'))
      await user.click(stepHeader('1. Papeles del auto'))
      expect(openSteps()).toEqual([])

      await act(async () => saving.reject(new HttpError(500, undefined)))

      expect(openSteps()).toEqual([1])
      expect(within(screen.getByRole('region', { name: '1. Papeles del auto' })).getByRole('alert')).toHaveTextContent(
        SAVE_ERROR,
      )
    })

    it('keeps which steps are open when going to the summary and back', async () => {
      const user = userEvent.setup()
      await renderPage(inspectionResponse({ items_completados: CRITICAL_CODES }))
      await user.click(stepHeader('3. Motor'))
      expect(openSteps()).toEqual([1, 3])
      await user.click(button('FINALIZAR'))

      await user.click(await screen.findByRole('button', { name: 'SEGUIR REVISANDO' }))

      expect(openSteps()).toEqual([1, 3])
    })
  })

  describe('autosave', () => {
    it('TC-35: ticking saves the item right away and updates the counter', async () => {
      const user = userEvent.setup()
      await renderPage()
      vi.mocked(setItemCompleted).mockResolvedValue(saved(['papeles_vtv']))

      await user.click(checkbox('La VTV está vigente'))

      expect(setItemCompleted).toHaveBeenCalledWith(7, 'papeles_vtv', true)
      expect(checkbox('La VTV está vigente')).toBeChecked()
      expect(counter()).toHaveTextContent('1 de 10 puntos revisados')
    })

    it('unticking saves the item with completed false', async () => {
      const user = userEvent.setup()
      await renderPage(inspectionResponse({ items_completados: ['papeles_vtv'] }))

      await user.click(checkbox('La VTV está vigente'))

      expect(setItemCompleted).toHaveBeenCalledWith(7, 'papeles_vtv', false)
      expect(checkbox('La VTV está vigente')).not.toBeChecked()
      expect(counter()).toHaveTextContent('0 de 10 puntos revisados')
    })

    it('shows no waiting state on the row: it ticks at once and stays clickable while saving', async () => {
      const user = userEvent.setup()
      await renderPage()
      vi.mocked(setItemCompleted).mockReturnValue(new Promise(() => {}))

      await user.click(checkbox('La VTV está vigente'))

      const row = checkbox('La VTV está vigente')
      expect(row).toBeChecked()
      expect(row).not.toHaveAttribute('aria-busy')
      expect(row).toBeEnabled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('reverts the item and shows the error inside its step card when the save fails', async () => {
      const user = userEvent.setup()
      await renderPage()
      vi.mocked(setItemCompleted).mockRejectedValue(new HttpError(500, undefined))

      await user.click(checkbox('La VTV está vigente'))

      const step = screen.getByRole('region', { name: '1. Papeles del auto' })
      expect(await within(step).findByRole('alert')).toHaveTextContent(SAVE_ERROR)
      expect(checkbox('La VTV está vigente')).not.toBeChecked()
      expect(counter()).toHaveTextContent('0 de 10 puntos revisados')
      expect(screen.getAllByRole('alert')).toHaveLength(1)
    })

    it('reverts an untick to ticked when the save fails', async () => {
      const user = userEvent.setup()
      await renderPage(inspectionResponse({ items_completados: ['papeles_vtv'] }))
      vi.mocked(setItemCompleted).mockRejectedValue(new NetworkError(new TypeError('Failed to fetch')))

      await user.click(checkbox('La VTV está vigente'))

      expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument()
      expect(checkbox('La VTV está vigente')).toBeChecked()
    })

    it('clears the step error on the next successful save in that step', async () => {
      const user = userEvent.setup()
      await renderPage()
      vi.mocked(setItemCompleted).mockRejectedValueOnce(new HttpError(500, undefined))
      await user.click(checkbox('La VTV está vigente'))
      await screen.findByText(SAVE_ERROR)

      vi.mocked(setItemCompleted).mockResolvedValue(saved(['papeles_vtv']))
      await user.click(checkbox('La VTV está vigente'))

      expect(screen.queryByText(SAVE_ERROR)).not.toBeInTheDocument()
      expect(checkbox('La VTV está vigente')).toBeChecked()
    })

    it('never replaces the local marks with a response: an older list cannot untick an item that settled (concurrent server)', async () => {
      const user = userEvent.setup()
      await renderPage()
      await expandAll(user)
      const first = deferred<InspectionProgress>()
      const second = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      await user.click(checkbox('La VTV está vigente'))
      await user.click(checkbox('Las luces funcionan'))
      // A settles; B's transaction read its list before A committed, so its answer lacks A.
      await act(async () => first.resolve(saved(['papeles_vtv'])))
      await act(async () => second.resolve(saved(['exterior_luces'])))

      expect(checkbox('La VTV está vigente')).toBeChecked()
      expect(checkbox('Las luces funcionan')).toBeChecked()
      expect(counter()).toHaveTextContent('2 de 10 puntos revisados')
    })

    it('ignores the list of a response in any order', async () => {
      const user = userEvent.setup()
      await renderPage()
      await expandAll(user)
      const first = deferred<InspectionProgress>()
      const second = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      await user.click(checkbox('La VTV está vigente'))
      await user.click(checkbox('Las luces funcionan'))
      await act(async () => second.resolve(saved(['papeles_vtv', 'exterior_luces'])))
      await act(async () => first.resolve(saved(['papeles_vtv'])))

      expect(counter()).toHaveTextContent('2 de 10 puntos revisados')
      expect(checkbox('Las luces funcionan')).toBeChecked()
    })

    it('reverts only the failed item when another one is saving at the same time', async () => {
      const user = userEvent.setup()
      await renderPage()
      await expandAll(user)
      const first = deferred<InspectionProgress>()
      const second = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      await user.click(checkbox('La VTV está vigente'))
      await user.click(checkbox('Las luces funcionan'))
      await act(async () => first.reject(new HttpError(500, undefined)))
      await act(async () => second.resolve(saved(['exterior_luces'])))

      expect(checkbox('La VTV está vigente')).not.toBeChecked()
      expect(checkbox('Las luces funcionan')).toBeChecked()
      expect(counter()).toHaveTextContent('1 de 10 puntos revisados')
    })

    it('saves different items in parallel', async () => {
      const user = userEvent.setup()
      await renderPage()
      await expandAll(user)
      vi.mocked(setItemCompleted).mockReturnValue(new Promise(() => {}))

      await user.click(checkbox('La VTV está vigente'))
      await user.click(checkbox('Las luces funcionan'))

      expect(setItemCompleted).toHaveBeenCalledTimes(2)
    })

    it('keeps one request in flight per item: a quick untick is sent only after the tick settles', async () => {
      const user = userEvent.setup()
      await renderPage()
      const tick = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValueOnce(tick.promise).mockResolvedValue(saved())

      await user.dblClick(checkbox('La VTV está vigente'))

      expect(setItemCompleted).toHaveBeenCalledTimes(1)
      expect(setItemCompleted).toHaveBeenLastCalledWith(7, 'papeles_vtv', true)
      expect(checkbox('La VTV está vigente')).not.toBeChecked()

      await act(async () => tick.resolve(saved(['papeles_vtv'])))

      expect(setItemCompleted).toHaveBeenCalledTimes(2)
      expect(setItemCompleted).toHaveBeenLastCalledWith(7, 'papeles_vtv', false)
      expect(checkbox('La VTV está vigente')).not.toBeChecked()
    })

    it('sends nothing more when tick, untick, tick quickly ends where the request in flight is going', async () => {
      const user = userEvent.setup()
      await renderPage()
      const tick = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValueOnce(tick.promise).mockResolvedValue(saved(['papeles_vtv']))

      const row = checkbox('La VTV está vigente')
      await user.click(row)
      await user.click(row)
      await user.click(row)
      await act(async () => tick.resolve(saved(['papeles_vtv'])))

      expect(setItemCompleted).toHaveBeenCalledTimes(1)
      expect(setItemCompleted).toHaveBeenCalledWith(7, 'papeles_vtv', true)
      expect(checkbox('La VTV está vigente')).toBeChecked()
    })

    it('still sends the newer value when the request in flight fails, with no stale revert or error', async () => {
      const user = userEvent.setup()
      await renderPage(inspectionResponse({ items_completados: ['papeles_vtv'] }))
      const untick = deferred<InspectionProgress>()
      const tick = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValueOnce(untick.promise).mockReturnValueOnce(tick.promise)
      await user.dblClick(checkbox('La VTV está vigente'))
      expect(checkbox('La VTV está vigente')).toBeChecked()

      await act(async () => untick.reject(new HttpError(500, undefined)))

      // The server state after a failed write is unknown: the value the user wants now is sent anyway.
      expect(setItemCompleted).toHaveBeenCalledTimes(2)
      expect(setItemCompleted).toHaveBeenLastCalledWith(7, 'papeles_vtv', true)
      expect(checkbox('La VTV está vigente')).toBeChecked()
      expect(screen.queryByText(SAVE_ERROR)).not.toBeInTheDocument()

      await act(async () => tick.resolve(saved(['papeles_vtv'])))

      expect(checkbox('La VTV está vigente')).toBeChecked()
      expect(screen.queryByText(SAVE_ERROR)).not.toBeInTheDocument()
    })

    it('reverts to the last value the server confirmed when the queued value fails too', async () => {
      const user = userEvent.setup()
      await renderPage()
      const tick = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValueOnce(tick.promise)
      await user.click(checkbox('La VTV está vigente'))
      await act(async () => tick.resolve(saved(['papeles_vtv'])))
      vi.mocked(setItemCompleted).mockRejectedValue(new HttpError(500, undefined))

      await user.click(checkbox('La VTV está vigente'))

      expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument()
      expect(checkbox('La VTV está vigente')).toBeChecked()
    })
  })

  describe('finish', () => {
    const allCritical = () => inspectionResponse({ items_completados: CRITICAL_CODES })

    it('TC-35: finishes with no critical item pending and shows the summary view', async () => {
      const user = userEvent.setup()
      await renderPage(allCritical())

      await user.click(button('FINALIZAR'))

      expect(finishInspection).toHaveBeenCalledWith(7)
      expect(await screen.findByRole('button', { name: 'SEGUIR REVISANDO' })).toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Toyota Corolla XEI 2021' })).toHaveFocus()
    })

    it('keeps the local marks after finishing instead of taking the response list', async () => {
      const user = userEvent.setup()
      await renderPage(allCritical())
      vi.mocked(finishInspection).mockResolvedValue({ estado: 'incompleta', items_completados: [] })

      await user.click(button('FINALIZAR'))

      await screen.findByRole('button', { name: 'SEGUIR REVISANDO' })
      expect(counter()).toHaveTextContent('4 de 10 puntos revisados')
    })

    it('shows the finishing state on the pressed button and disables both while it waits', async () => {
      const user = userEvent.setup()
      await renderPage(allCritical())
      const finishing = deferred<InspectionProgress>()
      vi.mocked(finishInspection).mockReturnValue(finishing.promise)

      await user.click(button('FINALIZAR'))

      const busy = button('FINALIZANDO…')
      expect(busy).toBeDisabled()
      expect(busy).toHaveAttribute('aria-busy', 'true')
      await user.click(busy)
      expect(finishInspection).toHaveBeenCalledTimes(1)

      await act(async () => finishing.resolve({ estado: 'incompleta', items_completados: CRITICAL_CODES }))
      expect(await screen.findByRole('button', { name: 'SEGUIR REVISANDO' })).toBeInTheDocument()
    })

    it('shows an error next to the buttons and stays on the checklist when finishing fails', async () => {
      const user = userEvent.setup()
      await renderPage(allCritical())
      vi.mocked(finishInspection).mockRejectedValue(new HttpError(500, undefined))

      await user.click(button('FINALIZAR'))

      expect(await screen.findByText(FINISH_ERROR)).toHaveAttribute('role', 'alert')
      expect(button('FINALIZAR')).toBeEnabled()
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)

      vi.mocked(finishInspection).mockResolvedValue({ estado: 'incompleta', items_completados: CRITICAL_CODES })
      await user.click(button('FINALIZAR'))
      expect(await screen.findByRole('button', { name: 'SEGUIR REVISANDO' })).toBeInTheDocument()
      expect(screen.queryByText(FINISH_ERROR)).not.toBeInTheDocument()
    })

    it('waits for the saves in flight before finishing, showing the busy state at once', async () => {
      const user = userEvent.setup()
      await renderPage(allCritical())
      const saving = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValue(saving.promise)
      await user.click(checkbox('La VTV está vigente'))

      await user.click(button('FINALIZAR'))

      expect(button('FINALIZANDO…')).toBeDisabled()
      expect(finishInspection).not.toHaveBeenCalled()

      await act(async () => saving.resolve(saved([...CRITICAL_CODES, 'papeles_vtv'])))

      expect(finishInspection).toHaveBeenCalledTimes(1)
      expect(await screen.findByRole('button', { name: 'SEGUIR REVISANDO' })).toBeInTheDocument()
      expect(counter()).toHaveTextContent('5 de 10 puntos revisados')
    })

    it('does not finish when a save fails while it waits: shows the step error and stays on the checklist', async () => {
      const user = userEvent.setup()
      await renderPage(allCritical())
      const saving = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValue(saving.promise)
      await user.click(checkbox('La VTV está vigente'))
      await user.click(button('FINALIZAR'))

      await act(async () => saving.reject(new HttpError(500, undefined)))

      expect(finishInspection).not.toHaveBeenCalled()
      expect(screen.getByText(SAVE_ERROR)).toBeInTheDocument()
      expect(screen.queryByText(FINISH_ERROR)).not.toBeInTheDocument()
      expect(button('FINALIZAR')).toBeEnabled()
      expect(checkbox('La VTV está vigente')).not.toBeChecked()
    })

    it('TC-37: warns before finishing when critical items are pending, without calling the API', async () => {
      const user = userEvent.setup()
      await renderPage(inspectionResponse({ items_completados: ['papeles_titular'] }))

      await user.click(button('FINALIZAR'))

      const warning = screen.getByText(/sin revisar/)
      expect(warning).toHaveAttribute('role', 'alert')
      expect(warning).toHaveTextContent(
        'Te quedan 3 puntos críticos sin revisar. Son los que más pesan a la hora de decidir: revisalos antes de terminar.',
      )
      expect(warning).toHaveFocus()
      expect(finishInspection).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'FINALIZAR' })).not.toBeInTheDocument()
      expect(button('FINALIZAR IGUAL')).toBeInTheDocument()
      expect(button('SEGUIR REVISANDO')).toBeInTheDocument()
    })

    it('expands every step that has a critical item pending when the warning opens', async () => {
      const user = userEvent.setup()
      await renderPage(inspectionResponse({ items_completados: ['papeles_titular', 'papeles_vtv'] }))
      await user.click(stepHeader('3. Motor'))
      await user.click(stepHeader('3. Motor'))
      expect(openSteps()).toEqual([2])

      await user.click(button('FINALIZAR'))

      // Steps 2, 3 and 5 hold the pending critical items; step 4 has none.
      expect(openSteps()).toEqual([2, 3, 5])
    })

    it('uses the singular when one critical item is pending', async () => {
      const user = userEvent.setup()
      await renderPage(inspectionResponse({ items_completados: CRITICAL_CODES.slice(1) }))

      await user.click(button('FINALIZAR'))

      expect(screen.getByText(/sin revisar/)).toHaveTextContent(
        'Te queda 1 punto crítico sin revisar. Es el que más pesa a la hora de decidir: revisalo antes de terminar.',
      )
    })

    it('SEGUIR REVISANDO hides the warning and brings FINALIZAR back', async () => {
      const user = userEvent.setup()
      await renderPage()
      await user.click(button('FINALIZAR'))

      await user.click(button('SEGUIR REVISANDO'))

      expect(screen.queryByText(/sin revisar/)).not.toBeInTheDocument()
      expect(button('FINALIZAR')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'FINALIZAR IGUAL' })).not.toBeInTheDocument()
      expect(finishInspection).not.toHaveBeenCalled()
    })

    it('FINALIZAR IGUAL finishes with critical items pending and shows the summary view', async () => {
      const user = userEvent.setup()
      await renderPage()
      vi.mocked(finishInspection).mockResolvedValue({ estado: 'incompleta', items_completados: [] })
      await user.click(button('FINALIZAR'))

      await user.click(button('FINALIZAR IGUAL'))

      expect(finishInspection).toHaveBeenCalledWith(7)
      expect(await screen.findByRole('heading', { level: 1, name: 'Toyota Corolla XEI 2021' })).toHaveFocus()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByText(/sin revisar/)).not.toBeInTheDocument()
    })

    it('shows the finishing state on FINALIZAR IGUAL and the error when it fails', async () => {
      const user = userEvent.setup()
      await renderPage()
      const finishing = deferred<InspectionProgress>()
      vi.mocked(finishInspection).mockReturnValue(finishing.promise)
      await user.click(button('FINALIZAR'))

      await user.click(button('FINALIZAR IGUAL'))

      expect(button('FINALIZANDO…')).toBeDisabled()
      expect(button('SEGUIR REVISANDO')).toBeDisabled()

      await act(async () => finishing.reject(new NetworkError(new TypeError('Failed to fetch'))))

      expect(screen.getByText(FINISH_ERROR)).toBeInTheDocument()
      expect(button('FINALIZAR IGUAL')).toBeEnabled()
    })

    it('updates the warning count live and returns to FINALIZAR when no critical item is left', async () => {
      const user = userEvent.setup()
      await renderPage(inspectionResponse({ items_completados: CRITICAL_CODES.slice(2) }))
      await user.click(button('FINALIZAR'))
      expect(screen.getByText(/sin revisar/)).toHaveTextContent('Te quedan 2 puntos críticos sin revisar.')

      await user.click(checkbox('La pintura es pareja CRÍTICO'))
      expect(screen.getByText(/sin revisar/)).toHaveTextContent('Te queda 1 punto crítico sin revisar.')

      await user.click(checkbox('El titular coincide con el vendedor CRÍTICO'))

      expect(screen.queryByText(/sin revisar/)).not.toBeInTheDocument()
      expect(button('FINALIZAR')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'SEGUIR REVISANDO' })).not.toBeInTheDocument()
    })

    it('FINALIZAR IGUAL waits for the saves in flight too', async () => {
      const user = userEvent.setup()
      await renderPage()
      await user.click(button('FINALIZAR'))
      const saving = deferred<InspectionProgress>()
      vi.mocked(setItemCompleted).mockReturnValue(saving.promise)
      await user.click(checkbox('La VTV está vigente'))

      await user.click(button('FINALIZAR IGUAL'))

      expect(button('FINALIZANDO…')).toBeDisabled()
      expect(finishInspection).not.toHaveBeenCalled()
      await act(async () => saving.resolve(saved(['papeles_vtv'])))
      expect(finishInspection).toHaveBeenCalledTimes(1)
    })
  })

  describe('summary view', () => {
    it('SEGUIR REVISANDO returns to the checklist with the marks intact', async () => {
      const user = userEvent.setup()
      await renderPage(inspectionResponse({ items_completados: CRITICAL_CODES }))
      vi.mocked(finishInspection).mockResolvedValue({ estado: 'incompleta', items_completados: CRITICAL_CODES })
      await user.click(button('FINALIZAR'))

      await user.click(await screen.findByRole('button', { name: 'SEGUIR REVISANDO' }))

      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
      await expandAll(user)
      expect(screen.getAllByRole('checkbox')).toHaveLength(10)
      expect(checkbox('Los frenos responden bien CRÍTICO')).toBeChecked()
      expect(counter()).toHaveTextContent('4 de 10 puntos revisados')
      expect(button('FINALIZAR')).toBeInTheDocument()
    })
  })
})
