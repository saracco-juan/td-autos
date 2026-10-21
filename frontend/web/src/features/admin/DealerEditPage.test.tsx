import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { deleteDealer, fetchDealer, updateDealer } from './api'
import DealerEditPage from './DealerEditPage'
import { dealerDetail, dealerSubscription } from './fixtures'

vi.mock('./api', () => ({ fetchDealer: vi.fn(), updateDealer: vi.fn(), deleteDealer: vi.fn() }))

const SAVE = 'GUARDAR CONCESIONARIA'
const SUCCESS = 'Guardaste los cambios de la concesionaria.'
const SAVE_ERROR = 'No pudimos guardar los cambios. Intentá nuevamente.'

type UserEventInstance = ReturnType<typeof userEvent.setup>

// The dealer list, showing the navigation state it was reached with (the success notice of a delete).
function ListProbe() {
  const { state } = useLocation()
  return (
    <>
      <p>Lista de concesionarias</p>
      <p>Estado: {JSON.stringify(state)}</p>
    </>
  )
}

function renderPage(id = '5') {
  render(
    <MemoryRouter initialEntries={[`/admin/concesionarias/${id}`]}>
      <Routes>
        <Route path="/admin/concesionarias/:id" element={<DealerEditPage />} />
        <Route path="/admin/concesionarias" element={<ListProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function loaded() {
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Editar concesionaria' })
}

async function replaceText(user: UserEventInstance, label: string, text: string) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  if (text) await user.type(input, text)
}

const save = (user: UserEventInstance) => user.click(screen.getByRole('button', { name: SAVE }))
const section = (name: string) => within(screen.getByRole('region', { name }))
const definition = (label: string) => screen.getByText(label).nextElementSibling

describe('DealerEditPage (UH27, Figma 38:1099, TC-69)', () => {
  beforeEach(() => {
    vi.mocked(fetchDealer).mockReset().mockResolvedValue(dealerDetail())
    vi.mocked(updateDealer).mockReset().mockResolvedValue(dealerDetail())
    vi.mocked(deleteDealer).mockReset().mockResolvedValue(undefined)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 15, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loading', () => {
    it('shows a centered loader in place of the form while the dealer loads', () => {
      vi.mocked(fetchDealer).mockReturnValue(new Promise(() => {}))
      renderPage()

      expect(screen.getByRole('status')).toHaveTextContent('Cargando')
      expect(screen.queryByLabelText('Nombre comercial')).not.toBeInTheDocument()
    })

    it('reads the dealer of the route', async () => {
      await loaded()

      expect(fetchDealer).toHaveBeenCalledWith(5)
    })

    it.each([
      ['a network failure', new NetworkError(new TypeError('Failed to fetch')), 'Sin conexión con el servidor'],
      ['a server failure', new HttpError(500, undefined), 'Algo salió mal'],
    ])('shows the error state after %s, and REINTENTAR loads the dealer', async (_label, failure, title) => {
      vi.mocked(fetchDealer).mockRejectedValueOnce(failure)
      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(title)
      await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Editar concesionaria' })).toBeInTheDocument()
      expect(fetchDealer).toHaveBeenCalledTimes(2)
    })

    it('tells the admin the dealer does not exist (404) and offers the way back', async () => {
      vi.mocked(fetchDealer).mockRejectedValue(new HttpError(404, { message: 'No encontramos la concesionaria.' }))
      renderPage('99')

      expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos la concesionaria.')
      expect(screen.queryByLabelText('Nombre comercial')).not.toBeInTheDocument()

      await userEvent.setup().click(screen.getByRole('link', { name: 'Volver a concesionarias' }))
      expect(screen.getByText('Lista de concesionarias')).toBeInTheDocument()
    })
  })

  describe('form', () => {
    it('shows the header of the frame and the back link', async () => {
      await loaded()

      expect(screen.getByText('CONCESIONARIAS')).toBeInTheDocument()
      expect(screen.getByText('Cambios sobre el registro seleccionado.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Volver a concesionarias' })).toHaveAttribute('href', '/admin/concesionarias')
    })

    it('fills every RF15 field with the dealer data, locality and province apart', async () => {
      await loaded()

      expect(screen.getByLabelText('Nombre comercial')).toHaveValue('Concesionaria Sur')
      expect(screen.getByLabelText('Nombre del responsable')).toHaveValue('Marta')
      expect(screen.getByLabelText('Apellido del responsable')).toHaveValue('Gómez')
      expect(screen.getByLabelText('DNI del responsable')).toHaveValue('30111222')
      expect(screen.getByLabelText('Teléfono del responsable')).toHaveValue('11 4444-5555')
      expect(screen.getByLabelText('Teléfono público')).toHaveValue('11 4000-0000')
      expect(screen.getByLabelText('Email')).toHaveValue('sur@example.com')
      expect(screen.getByLabelText('Dirección')).toHaveValue('Av. Ejemplo 1234')
      expect(screen.getByLabelText('Localidad')).toHaveValue('CABA')
      expect(screen.getByLabelText('Provincia')).toHaveValue('CABA')
    })

    it('has CANCELAR and GUARDAR CONCESIONARIA, and ELIMINAR only in its own section (UH28)', async () => {
      await loaded()

      expect(screen.getByRole('button', { name: 'CANCELAR' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: SAVE })).toBeInTheDocument()
      const [remove] = screen.getAllByRole('button', { name: 'ELIMINAR' })
      expect(screen.getAllByRole('button', { name: 'ELIMINAR' })).toHaveLength(1)
      expect(section('Eliminar concesionaria').getByRole('button', { name: 'ELIMINAR' })).toBe(remove)
    })

    it('CANCELAR goes back to the dealer list without saving', async () => {
      await loaded()
      const user = userEvent.setup()
      await replaceText(user, 'Nombre comercial', 'Otro nombre')

      await user.click(screen.getByRole('button', { name: 'CANCELAR' }))

      expect(screen.getByText('Lista de concesionarias')).toBeInTheDocument()
      expect(updateDealer).not.toHaveBeenCalled()
    })
  })

  describe('saving (TC-69)', () => {
    it('sends the edited data trimmed to the dealer of the route and shows the success box with the saved values', async () => {
      const saved = dealerDetail({ nombre: 'Sur Motors', telefono_publico: '11 5555-0000' })
      vi.mocked(updateDealer).mockResolvedValue(saved)
      await loaded()
      const user = userEvent.setup()

      await replaceText(user, 'Nombre comercial', '  Sur Motors  ')
      await replaceText(user, 'Teléfono público', '11 5555-0000')
      await save(user)

      expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS)
      expect(updateDealer).toHaveBeenCalledTimes(1)
      expect(updateDealer).toHaveBeenCalledWith(5, {
        nombre: 'Sur Motors',
        responsable_nombre: 'Marta',
        responsable_apellido: 'Gómez',
        responsable_dni: '30111222',
        telefono_responsable: '11 4444-5555',
        telefono_publico: '11 5555-0000',
        email: 'sur@example.com',
        direccion: 'Av. Ejemplo 1234',
        localidad: 'CABA',
        provincia: 'CABA',
      })
      expect(screen.getByLabelText('Nombre comercial')).toHaveValue('Sur Motors')
      expect(screen.getByLabelText('Teléfono público')).toHaveValue('11 5555-0000')
    })

    it('shows the busy state on the save button only while the request is pending', async () => {
      let finish: (dealer: ReturnType<typeof dealerDetail>) => void = () => {}
      vi.mocked(updateDealer).mockReturnValue(new Promise((resolve) => (finish = resolve)))
      await loaded()
      const user = userEvent.setup()

      await save(user)

      const button = screen.getByRole('button', { name: /GUARDANDO/ })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByLabelText('Nombre comercial')).toBeEnabled()
      expect(screen.getByRole('button', { name: 'CANCELAR' })).toBeEnabled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()

      finish(dealerDetail())
      expect(await screen.findByRole('button', { name: SAVE })).toBeEnabled()
    })

    it('blocks the request and shows each invalid field under its input', async () => {
      await loaded()
      const user = userEvent.setup()

      await replaceText(user, 'Nombre comercial', '')
      await replaceText(user, 'Email', 'sur-at-example')
      await replaceText(user, 'DNI del responsable', '1'.repeat(21))
      await save(user)

      expect(updateDealer).not.toHaveBeenCalled()
      expect(screen.getByText('El nombre de la concesionaria es obligatorio.')).toBeInTheDocument()
      expect(screen.getByText('Ingresá un email válido.')).toBeInTheDocument()
      expect(screen.getByText('El DNI no puede superar los 20 caracteres.')).toBeInTheDocument()
      expect(screen.getByLabelText('Nombre comercial')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument()
    })

    it('clears the error of a field when it is edited', async () => {
      await loaded()
      const user = userEvent.setup()
      await replaceText(user, 'Localidad', '')
      await save(user)
      expect(screen.getByText('La localidad es obligatoria.')).toBeInTheDocument()

      await user.type(screen.getByLabelText('Localidad'), 'Rosario')

      expect(screen.queryByText('La localidad es obligatoria.')).not.toBeInTheDocument()
    })

    it('shows the 422 errors of the server under their fields and nothing as saved', async () => {
      vi.mocked(updateDealer).mockRejectedValue(
        new HttpError(422, { errors: { email: ['Ese email ya está en uso.'], provincia: ['La provincia es obligatoria.'] } }),
      )
      await loaded()
      const user = userEvent.setup()

      await save(user)

      expect(await screen.findByText('Ese email ya está en uso.')).toBeInTheDocument()
      expect(screen.getByText('La provincia es obligatoria.')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument()
    })

    it.each([
      ['a 422 without field errors', new HttpError(422, {})],
      ['a server failure', new HttpError(500, undefined)],
      ['a network failure', new NetworkError(new TypeError('Failed to fetch'))],
    ])('shows an error box after %s and keeps what was typed', async (_label, failure) => {
      vi.mocked(updateDealer).mockRejectedValue(failure)
      await loaded()
      const user = userEvent.setup()
      await replaceText(user, 'Nombre comercial', 'Sur Motors')

      await save(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_ERROR)
      expect(screen.getByLabelText('Nombre comercial')).toHaveValue('Sur Motors')
      expect(screen.getByRole('button', { name: SAVE })).toBeEnabled()
    })

    it('shows the not-found box when the dealer disappeared meanwhile (404)', async () => {
      vi.mocked(updateDealer).mockRejectedValue(new HttpError(404, { message: 'No encontramos la concesionaria.' }))
      await loaded()

      await save(userEvent.setup())

      expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos la concesionaria.')
    })
  })

  describe('subscription (read-only, scenario 2)', () => {
    it('shows the dealer state, the subscription state and its validity', async () => {
      vi.mocked(fetchDealer).mockResolvedValue(
        dealerDetail({ estado_alta: 'activa', suscripcion: dealerSubscription({ estado: 'pendiente', vigente_desde: '2026-09-14', vigente_hasta: '2026-10-13' }) }),
      )
      await loaded()

      expect(definition('Estado de la concesionaria')).toHaveTextContent('Activa')
      expect(definition('Estado de la suscripción')).toHaveTextContent('Pendiente de aprobación')
      expect(section('Suscripción').getByText('Vigente desde 14/09/2026 hasta 13/10/2026')).toBeInTheDocument()
    })

    it('shows the grace period with its deadline, the account still active', async () => {
      vi.mocked(fetchDealer).mockResolvedValue(
        dealerDetail({
          suscripcion: dealerSubscription({ estado: 'gracia', vigente_desde: '2026-09-14', vigente_hasta: '2026-10-13', gracia_hasta: '2026-10-16' }),
        }),
      )
      await loaded()

      expect(definition('Estado de la concesionaria')).toHaveTextContent('Activa')
      expect(definition('Estado de la concesionaria')).toHaveTextContent('En período de gracia')
      expect(section('Suscripción').getByText('Vigente desde 14/09/2026 hasta 13/10/2026')).toBeInTheDocument()
      expect(section('Suscripción').getByText('Gracia hasta el 16/10/2026')).toBeInTheDocument()
      expect(screen.queryByText(/Retención/)).not.toBeInTheDocument()
    })

    it('shows an inactive subscription as Inactiva with a tag and the grace and retention deadlines', async () => {
      vi.mocked(fetchDealer).mockResolvedValue(
        dealerDetail({
          suscripcion: dealerSubscription({
            estado: 'inactiva',
            vigente_desde: '2026-08-14',
            vigente_hasta: '2026-09-13',
            gracia_hasta: '2026-09-16',
            retencion_hasta: '2026-10-17',
          }),
        }),
      )
      await loaded()

      expect(definition('Estado de la concesionaria')).toHaveTextContent('Inactiva')
      expect(definition('Estado de la concesionaria')).toHaveTextContent('Suscripción vencida')
      expect(definition('Estado de la concesionaria')).not.toHaveTextContent('Activa')
      expect(section('Suscripción').getByText('Gracia hasta el 16/09/2026')).toBeInTheDocument()
      expect(section('Suscripción').getByText('Vehículos conservados hasta el 17/10/2026')).toBeInTheDocument()
    })

    it('says the vehicles were deleted once the retention deadline is reached', async () => {
      vi.mocked(fetchDealer).mockResolvedValue(
        dealerDetail({
          suscripcion: dealerSubscription({
            estado: 'inactiva',
            vigente_desde: '2026-08-14',
            vigente_hasta: '2026-09-13',
            gracia_hasta: '2026-09-16',
            retencion_hasta: '2026-10-15',
          }),
        }),
      )
      await loaded()

      expect(section('Suscripción').getByText('Vehículos eliminados el 15/10/2026')).toBeInTheDocument()
      expect(section('Suscripción').queryByText(/conservados/)).not.toBeInTheDocument()
    })

    it('says so when the dealer has no subscription yet', async () => {
      vi.mocked(fetchDealer).mockResolvedValue(dealerDetail({ estado_alta: 'pendiente', suscripcion: null, comprobantes: [] }))
      await loaded()

      expect(definition('Estado de la concesionaria')).toHaveTextContent('Pendiente de aprobación')
      expect(section('Suscripción').getByText('Todavía no tiene una suscripción.')).toBeInTheDocument()
      expect(screen.queryByText(/Vigente desde/)).not.toBeInTheDocument()
    })

    it('shows a subscription without validity dates as not valid yet', async () => {
      vi.mocked(fetchDealer).mockResolvedValue(
        dealerDetail({ suscripcion: dealerSubscription({ estado: 'pendiente' }) }),
      )
      await loaded()

      expect(definition('Estado de la suscripción')).toHaveTextContent('Pendiente de aprobación')
      expect(screen.queryByText(/Vigente desde/)).not.toBeInTheDocument()
      expect(section('Suscripción').getByText('Todavía no tiene vigencia.')).toBeInTheDocument()
    })
  })

  describe('receipt history (read-only)', () => {
    const rows = () => section('Comprobantes').getAllByRole('listitem')

    it('lists the receipts in the order the API sends them, with type, period, sent date and state', async () => {
      await loaded()

      expect(rows()).toHaveLength(3)
      expect(rows()[0]).toHaveTextContent('Renovación')
      expect(rows()[0]).toHaveTextContent('14/10/2026 al 13/11/2026')
      expect(rows()[0]).toHaveTextContent('Enviado el 14/10/2026')
      expect(rows()[0]).toHaveTextContent('Pendiente de revisión')
      expect(rows()[1]).toHaveTextContent('Alta')
      expect(rows()[1]).toHaveTextContent('Aprobado')
      expect(rows()[2]).toHaveTextContent('Rechazado')
    })

    it('shows the reason of a rejected receipt and only of that one', async () => {
      await loaded()

      expect(rows()[2]).toHaveTextContent('Motivo: El monto no coincide con la cuota.')
      expect(screen.getAllByText(/Motivo:/)).toHaveLength(1)
    })

    it('leads to the review: REVISAR for the pending receipt, VER for the decided ones', async () => {
      await loaded()

      expect(within(rows()[0]).getByRole('link', { name: 'REVISAR' })).toHaveAttribute('href', '/admin/comprobantes/31')
      expect(within(rows()[1]).getByRole('link', { name: 'VER' })).toHaveAttribute('href', '/admin/comprobantes/27')
      expect(within(rows()[2]).getByRole('link', { name: 'VER' })).toHaveAttribute('href', '/admin/comprobantes/20')
    })

    it('shows a receipt without a sent date without that line', async () => {
      const [first, ...rest] = dealerDetail().comprobantes
      vi.mocked(fetchDealer).mockResolvedValue(dealerDetail({ comprobantes: [{ ...first, enviado_en: null }, ...rest] }))
      await loaded()

      expect(rows()[0]).not.toHaveTextContent('Enviado el')
    })

    it('shows an empty message when the dealer never sent a receipt', async () => {
      vi.mocked(fetchDealer).mockResolvedValue(dealerDetail({ comprobantes: [] }))
      await loaded()

      expect(section('Comprobantes').getByText('Todavía no envió comprobantes.')).toBeInTheDocument()
      expect(section('Comprobantes').queryByRole('list')).not.toBeInTheDocument()
    })
  })
  describe('deleting (UH28, TC-71, TC-72)', () => {
    const CONFIRM_TEXT =
      '¿Eliminar esta concesionaria? Se borran sus vehículos, leads, suscripción y comprobantes, y su cuenta. No se puede deshacer.'
    const BLOCKED_REASON = 'No podés eliminarla mientras tenga la suscripción vigente.'
    const DELETE_ERROR = 'No pudimos eliminar la concesionaria. Probá de nuevo.'
    const removal = () => section('Eliminar concesionaria')

    async function removable() {
      vi.mocked(fetchDealer).mockResolvedValue(dealerDetail({ puede_eliminarse: true }))
      await loaded()
    }

    const askDelete = (user: UserEventInstance) => user.click(removal().getByRole('button', { name: 'ELIMINAR' }))

    it('disables ELIMINAR and says why while the subscription is current (TC-71)', async () => {
      vi.mocked(fetchDealer).mockResolvedValue(dealerDetail({ puede_eliminarse: false }))
      await loaded()

      const button = removal().getByRole('button', { name: 'ELIMINAR' })
      expect(button).toBeDisabled()
      expect(button).toHaveAccessibleDescription(BLOCKED_REASON)
    })

    it('asks for confirmation before deleting and focuses it', async () => {
      const user = userEvent.setup()
      await removable()

      await askDelete(user)

      expect(removal().getByText(CONFIRM_TEXT)).toBeInTheDocument()
      expect(removal().getByRole('button', { name: 'ELIMINAR' })).toHaveFocus()
      expect(removal().getByRole('button', { name: 'CANCELAR' })).toBeInTheDocument()
      expect(deleteDealer).not.toHaveBeenCalled()
    })

    it('CANCELAR closes the confirmation and gives the focus back to ELIMINAR', async () => {
      const user = userEvent.setup()
      await removable()
      await askDelete(user)

      await user.click(removal().getByRole('button', { name: 'CANCELAR' }))

      expect(removal().queryByText(CONFIRM_TEXT)).not.toBeInTheDocument()
      expect(removal().getByRole('button', { name: 'ELIMINAR' })).toHaveFocus()
      expect(deleteDealer).not.toHaveBeenCalled()
    })

    it('deletes the dealer and goes back to the list with the notice (TC-72)', async () => {
      const user = userEvent.setup()
      await removable()
      await askDelete(user)

      await user.click(removal().getByRole('button', { name: 'ELIMINAR' }))

      expect(deleteDealer).toHaveBeenCalledWith(5)
      expect(await screen.findByText('Lista de concesionarias')).toBeInTheDocument()
      expect(screen.getByText(/^Estado:/)).toHaveTextContent('{"notice":"Eliminaste la concesionaria."}')
    })

    it('shows the busy state while the delete runs', async () => {
      const user = userEvent.setup()
      vi.mocked(deleteDealer).mockReturnValue(new Promise(() => {}))
      await removable()
      await askDelete(user)

      await user.click(removal().getByRole('button', { name: 'ELIMINAR' }))

      const busy = removal().getByRole('button', { name: 'ELIMINANDO…' })
      expect(busy).toBeDisabled()
      expect(busy).toHaveAttribute('aria-busy', 'true')
      expect(removal().getByRole('button', { name: 'CANCELAR' })).toBeDisabled()
    })

    it('shows the message of a 409 inside the confirmation (the subscription became current)', async () => {
      const user = userEvent.setup()
      const message = 'No podés eliminar una concesionaria con la suscripción vigente.'
      vi.mocked(deleteDealer).mockRejectedValue(new HttpError(409, { message }))
      await removable()
      await askDelete(user)

      await user.click(removal().getByRole('button', { name: 'ELIMINAR' }))

      expect(await removal().findByRole('alert')).toHaveTextContent(message)
      expect(removal().getByText(CONFIRM_TEXT)).toBeInTheDocument()
      expect(screen.queryByText('Lista de concesionarias')).not.toBeInTheDocument()
    })

    it.each([
      ['a network failure', new NetworkError(new TypeError('Failed to fetch'))],
      ['a server error', new HttpError(500, undefined)],
    ])('shows the error and keeps the confirmation after %s', async (_, failure) => {
      const user = userEvent.setup()
      vi.mocked(deleteDealer).mockRejectedValue(failure)
      await removable()
      await askDelete(user)

      await user.click(removal().getByRole('button', { name: 'ELIMINAR' }))

      expect(await removal().findByRole('alert')).toHaveTextContent(DELETE_ERROR)
      expect(removal().getByRole('button', { name: 'ELIMINAR' })).toHaveFocus()
    })

    it('treats a 404 as already deleted and goes back to the list with the notice', async () => {
      const user = userEvent.setup()
      vi.mocked(deleteDealer).mockRejectedValue(new HttpError(404, { message: 'No encontramos la concesionaria.' }))
      await removable()
      await askDelete(user)

      await user.click(removal().getByRole('button', { name: 'ELIMINAR' }))

      expect(await screen.findByText('Lista de concesionarias')).toBeInTheDocument()
      expect(screen.getByText(/^Estado:/)).toHaveTextContent('Eliminaste la concesionaria.')
    })
  })
})
