import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { fetchSubscription, sendReceipt } from './api'
import { TRANSFERENCIA, comprobantePendiente, comprobanteRechazado, suscripcion, vigencia } from './fixtures'
import SubscriptionPage from './SubscriptionPage'

vi.mock('./api', () => ({ fetchSubscription: vi.fn(), sendReceipt: vi.fn() }))

const SELECT = 'SELECCIONAR COMPROBANTE'
const SEND = 'ENVIAR COMPROBANTE'
const pdf = () => new File(['x'], 'pago-octubre.pdf', { type: 'application/pdf' })

async function loaded() {
  render(
    <MemoryRouter>
      <SubscriptionPage />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Suscripción y comprobantes' })
}

const card = (name: string) => within(screen.getByRole('region', { name }))
const sendButton = () => screen.getByRole('button', { name: SEND })
const pending = suscripcion({ comprobante_pendiente: comprobantePendiente() })

describe('SubscriptionPage', () => {
  beforeEach(() => {
    vi.mocked(fetchSubscription).mockReset()
    vi.mocked(sendReceipt).mockReset()
    vi.mocked(fetchSubscription).mockResolvedValue(suscripcion())
  })

  describe('loading', () => {
    it('shows a section loader while the summary loads', () => {
      vi.mocked(fetchSubscription).mockReturnValue(new Promise(() => {}))
      render(
        <MemoryRouter>
          <SubscriptionPage />
        </MemoryRouter>,
      )

      expect(screen.getByRole('status')).toHaveTextContent('Cargando')
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    })

    it.each([
      ['a network failure', new NetworkError(new TypeError('Failed to fetch')), 'Sin conexión con el servidor'],
      ['a server failure', new HttpError(500, undefined), 'Algo salió mal'],
    ])('shows the error state with REINTENTAR after %s, and retrying loads the page', async (_label, failure, title) => {
      vi.mocked(fetchSubscription).mockRejectedValueOnce(failure)
      render(
        <MemoryRouter>
          <SubscriptionPage />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(title)
      await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Suscripción y comprobantes' })).toBeInTheDocument()
      expect(fetchSubscription).toHaveBeenCalledTimes(2)
    })
  })

  describe('content of Figma 38:826', () => {
    it('renders the header and the renewal card', async () => {
      await loaded()

      expect(screen.getByText('SUSCRIPCIÓN')).toBeInTheDocument()
      expect(screen.getByText('Transferencia bancaria para el alta inicial y la renovación mensual.')).toBeInTheDocument()
      expect(card('Renovación y recuperación').getByText(/^Tras vencer el pago: 3 días plenamente operativos/)).toBeInTheDocument()
    })

    it.each([
      ['pendiente', 'Pendiente de aprobación inicial · inventario bloqueado'],
      ['activa', 'Activa'],
    ] as const)('shows the account status of a %s dealer', async (estado_alta, text) => {
      vi.mocked(fetchSubscription).mockResolvedValue(suscripcion({ estado_alta }))
      await loaded()

      expect(card('Estado de la cuenta').getByText(text)).toBeInTheDocument()
    })

    it('invites to select a receipt while there is none', async () => {
      await loaded()

      expect(card('Comprobante').getByText('Todavía no seleccionaste un comprobante.')).toBeInTheDocument()
      expect(card('Revisión').getByText('La administración aprueba o rechaza el comprobante.')).toBeInTheDocument()
    })

    it('shows the pending receipt with the local date it was sent, and that it is in review', async () => {
      const sent = new Date(2026, 9, 14, 12).toISOString()
      vi.mocked(fetchSubscription).mockResolvedValue(suscripcion({ comprobante_pendiente: comprobantePendiente({ enviado_en: sent }) }))
      await loaded()

      expect(card('Comprobante').getByText('comprobante-transferencia.pdf · enviado el 14/10/2026')).toBeInTheDocument()
      expect(card('Revisión').getByText('Tu comprobante está en revisión.')).toBeInTheDocument()
      expect(card('Revisión').queryByText('La administración aprueba o rechaza el comprobante.')).not.toBeInTheDocument()
    })

    it('tells the dealer the latest receipt was rejected, with the reason and the local date, and keeps the upload', async () => {
      const reviewed = new Date(2026, 9, 15, 12).toISOString()
      vi.mocked(fetchSubscription).mockResolvedValue(
        suscripcion({ ultimo_comprobante: comprobanteRechazado({ fecha_revision: reviewed }) }),
      )
      await loaded()

      const notice = within(screen.getByRole('region', { name: 'Tu comprobante fue rechazado' }))
      expect(notice.getByText('Lo rechazamos el 15/10/2026. Enviá uno nuevo para continuar.')).toBeInTheDocument()
      expect(notice.getByText('El monto no coincide con la cuota.')).toBeInTheDocument()
      expect(card('Revisión').getByText('Tu comprobante fue rechazado. Podés enviar uno nuevo.')).toBeInTheDocument()
      expect(screen.getByLabelText(SELECT)).toHaveAttribute('type', 'file')
      expect(sendButton()).toBeEnabled()
    })

    it('shows no rejection notice while a receipt is pending or when the latest one was approved', async () => {
      vi.mocked(fetchSubscription).mockResolvedValue(
        suscripcion({
          comprobante_pendiente: comprobantePendiente(),
          ultimo_comprobante: { id: 3, estado: 'pendiente de revisión', motivo_rechazo: null, fecha_revision: null },
        }),
      )
      await loaded()
      expect(screen.queryByRole('region', { name: 'Tu comprobante fue rechazado' })).not.toBeInTheDocument()
    })

    it('shows no rejection notice when the latest receipt was approved', async () => {
      vi.mocked(fetchSubscription).mockResolvedValue(
        suscripcion({ ultimo_comprobante: comprobanteRechazado({ estado: 'aprobado', motivo_rechazo: null }) }),
      )
      await loaded()
      expect(screen.queryByRole('region', { name: 'Tu comprobante fue rechazado' })).not.toBeInTheDocument()
    })

    it('shows the name of the selected file before it is sent', async () => {
      await loaded()

      await userEvent.setup().upload(screen.getByLabelText(SELECT), pdf())

      expect(card('Comprobante').getByText('pago-octubre.pdf')).toBeInTheDocument()
      expect(card('Comprobante').queryByText('Todavía no seleccionaste un comprobante.')).not.toBeInTheDocument()
    })
  })

  describe('transfer data card', () => {
    it.each([
      ['alta', 'Pago de alta inicial'],
      ['renovacion', 'Renovación mensual'],
    ] as const)('lists the data to transfer and the kind of payment (%s)', async (tipo_pago, kind) => {
      vi.mocked(fetchSubscription).mockResolvedValue(suscripcion({ tipo_pago }))
      await loaded()

      const data = card('Datos para la transferencia')
      expect(data.getByText(kind)).toBeInTheDocument()
      const expected: [string, string][] = [
        ['Titular', TRANSFERENCIA.titular],
        ['CUIT', TRANSFERENCIA.cuit],
        ['Banco', TRANSFERENCIA.banco],
        ['CBU', TRANSFERENCIA.cbu],
        ['Alias', TRANSFERENCIA.alias],
        ['Monto mensual', '$ 25.000'],
      ]
      for (const [term, value] of expected) {
        expect(data.getByText(term, { selector: 'dt' }).nextElementSibling).toHaveTextContent(value)
      }
    })

    it('sits between the three cards and the renewal card', async () => {
      await loaded()

      const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
      expect(titles).toEqual([
        'Estado de la cuenta',
        'Comprobante',
        'Revisión',
        'Datos para la transferencia',
        'Renovación y recuperación',
      ])
    })

    it('says the data are not available and disables sending when they are not configured', async () => {
      vi.mocked(fetchSubscription).mockResolvedValue(suscripcion({ transferencia: null }))
      await loaded()

      const data = card('Datos para la transferencia')
      expect(data.getByText('Los datos de transferencia no están disponibles por el momento. Probá más tarde.')).toBeInTheDocument()
      expect(data.queryByText('Titular')).not.toBeInTheDocument()
      expect(sendButton()).toBeDisabled()
    })
  })

  describe('actions', () => {
    it('offers SELECCIONAR and ENVIAR to a dealer with no pending receipt, and VER INVENTARIO only when active', async () => {
      await loaded()

      expect(screen.getByLabelText(SELECT)).toHaveAttribute('type', 'file')
      expect(sendButton()).toBeEnabled()
      expect(screen.queryByRole('link', { name: 'VER INVENTARIO' })).not.toBeInTheDocument()
    })

    it('links VER INVENTARIO to the inventory for an active dealer', async () => {
      vi.mocked(fetchSubscription).mockResolvedValue(suscripcion({ estado_alta: 'activa', tipo_pago: 'renovacion' }))
      await loaded()

      expect(screen.getByRole('link', { name: 'VER INVENTARIO' })).toHaveAttribute('href', '/concesionaria/inventario')
    })

    it('restricts the picker to PDF, JPG and PNG', async () => {
      await loaded()

      expect(screen.getByLabelText(SELECT)).toHaveAttribute('accept', '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png')
    })

    it('D3: hides SELECCIONAR and ENVIAR while a receipt is in review', async () => {
      vi.mocked(fetchSubscription).mockResolvedValue(pending)
      await loaded()

      expect(screen.queryByLabelText(SELECT)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: SEND })).not.toBeInTheDocument()
    })

    it('D3: an active dealer with a receipt in review still sees VER INVENTARIO', async () => {
      vi.mocked(fetchSubscription).mockResolvedValue({ ...pending, estado_alta: 'activa', tipo_pago: 'renovacion' })
      await loaded()

      expect(screen.getByRole('link', { name: 'VER INVENTARIO' })).toBeInTheDocument()
    })
  })

  describe('subscription validity (UH-20)', () => {
    const GRACE =
      'Tu suscripción venció el 13/10/2026. Tenés hasta el 16/10/2026 para que se apruebe la renovación; después tus vehículos dejan de publicarse.'
    const INACTIVE =
      'Tu suscripción está inactiva y tus vehículos no se publican. Los conservamos hasta el 15/11/2026: subí el comprobante de renovación para recuperarlos.'

    const withValidity = (validity: Parameters<typeof vigencia>[0]) =>
      vi.mocked(fetchSubscription).mockResolvedValue(
        suscripcion({ estado_alta: 'activa', tipo_pago: 'renovacion', suscripcion: vigencia(validity) }),
      )

    it('shows when an active subscription is valid until, with no notice', async () => {
      withValidity({ estado: 'activa', vigente_desde: '2026-09-14', vigente_hasta: '2026-10-13', gracia_hasta: '2026-10-16' })
      await loaded()

      expect(card('Estado de la cuenta').getByText('Suscripción vigente hasta el 13/10/2026')).toBeInTheDocument()
      expect(screen.queryByText(/venció/)).not.toBeInTheDocument()
      expect(screen.queryByText(/está inactiva/)).not.toBeInTheDocument()
    })

    it('warns in a filled box during the grace period and keeps VER INVENTARIO', async () => {
      withValidity({ estado: 'gracia', vigente_hasta: '2026-10-13', gracia_hasta: '2026-10-16' })
      await loaded()

      expect(screen.getByText(GRACE)).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(GRACE)
      expect(screen.queryByText(/Suscripción vigente hasta/)).not.toBeInTheDocument()
      expect(card('Estado de la cuenta').getByText('Activa')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'VER INVENTARIO' })).toBeInTheDocument()
    })

    it('says in an error box that it is inactive until the retention deadline, hides VER INVENTARIO and keeps the upload', async () => {
      withValidity({ estado: 'inactiva', vigente_hasta: '2026-10-01', gracia_hasta: '2026-10-04', retencion_hasta: '2026-11-15' })
      await loaded()

      expect(screen.getByText(INACTIVE)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(INACTIVE)
      expect(card('Estado de la cuenta').getByText('Inactiva · suscripción vencida')).toBeInTheDocument()
      expect(card('Estado de la cuenta').queryByText('Activa')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'VER INVENTARIO' })).not.toBeInTheDocument()
      expect(screen.getByLabelText(SELECT)).toBeEnabled()
      expect(sendButton()).toBeEnabled()
    })

    it('shows neither notice for a pending subscription', async () => {
      await loaded()

      expect(screen.queryByText(/venció/)).not.toBeInTheDocument()
      expect(screen.queryByText(/está inactiva/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Suscripción vigente hasta/)).not.toBeInTheDocument()
    })
  })

  describe('sending the receipt', () => {
    it('TC-81: sending without a file shows the required message, focused, and sends nothing', async () => {
      await loaded()

      await userEvent.setup().click(sendButton())

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Adjuntá el comprobante.')
      expect(alert).toHaveFocus()
      expect(sendReceipt).not.toHaveBeenCalled()
    })

    it('TC-48: an unsupported file is rejected with the invalid-format message and not sent', async () => {
      await loaded()
      const user = userEvent.setup({ applyAccept: false })

      await user.upload(screen.getByLabelText(SELECT), new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }))
      await user.click(sendButton())

      expect(screen.getByRole('alert')).toHaveTextContent('El comprobante tiene que ser PDF, JPG o PNG.')
      expect(sendReceipt).not.toHaveBeenCalled()
    })

    it('rejects a file over 5 MB without sending it', async () => {
      await loaded()
      const user = userEvent.setup()

      await user.upload(screen.getByLabelText(SELECT), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.pdf', { type: 'application/pdf' }))
      await user.click(sendButton())

      expect(screen.getByRole('alert')).toHaveTextContent('El comprobante no puede superar los 5 MB.')
      expect(sendReceipt).not.toHaveBeenCalled()
    })

    it('clears the message when another file is selected', async () => {
      await loaded()
      const user = userEvent.setup()
      await user.click(sendButton())
      expect(screen.getByRole('alert')).toBeInTheDocument()

      await user.upload(screen.getByLabelText(SELECT), pdf())

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('TC-47: sends the file, then shows it in review with a success message and without the send controls', async () => {
      vi.mocked(sendReceipt).mockResolvedValue(pending)
      await loaded()
      const user = userEvent.setup()
      const file = pdf()

      await user.upload(screen.getByLabelText(SELECT), file)
      await user.click(sendButton())

      const notice = await screen.findByRole('status')
      expect(notice).toHaveTextContent('Enviaste el comprobante. Queda pendiente de revisión.')
      expect(notice).toHaveFocus()
      expect(sendReceipt).toHaveBeenCalledWith(file)
      expect(card('Revisión').getByText('Tu comprobante está en revisión.')).toBeInTheDocument()
      expect(card('Comprobante').getByText(/^comprobante-transferencia\.pdf · enviado el /)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: SEND })).not.toBeInTheDocument()
      expect(screen.queryByLabelText(SELECT)).not.toBeInTheDocument()
    })

    it('marks only the send button busy and disabled while the request is in flight', async () => {
      let finish!: () => void
      vi.mocked(sendReceipt).mockReturnValue(new Promise((resolve) => (finish = () => resolve(pending))))
      await loaded()
      const user = userEvent.setup()

      await user.upload(screen.getByLabelText(SELECT), pdf())
      await user.click(sendButton())

      expect(sendButton()).toBeDisabled()
      expect(sendButton()).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      await user.click(sendButton())
      expect(sendReceipt).toHaveBeenCalledTimes(1)

      finish()
      await waitFor(() => expect(screen.queryByRole('button', { name: SEND })).not.toBeInTheDocument())
    })

    it.each([
      ['a 422', new HttpError(422, { errors: { comprobante: ['El comprobante no puede superar los 5 MB.'] } }), 'El comprobante no puede superar los 5 MB.'],
      ['a 409', new HttpError(409, { message: 'Ya tenés un comprobante en revisión.' }), 'Ya tenés un comprobante en revisión.'],
      ['a 503', new HttpError(503, { message: 'Los datos de transferencia no están disponibles.' }), 'Los datos de transferencia no están disponibles.'],
      ['a network failure', new NetworkError(new TypeError('Failed to fetch')), 'No pudimos enviar el comprobante. Probá de nuevo.'],
      ['a server failure', new HttpError(500, undefined), 'No pudimos enviar el comprobante. Probá de nuevo.'],
    ])('after %s shows the error, keeps the selected file and lets the dealer retry', async (_label, failure, message) => {
      vi.mocked(sendReceipt).mockRejectedValueOnce(failure)
      await loaded()
      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(SELECT), pdf())

      await user.click(sendButton())

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(message)
      expect(alert).toHaveFocus()
      expect(card('Comprobante').getByText('pago-octubre.pdf')).toBeInTheDocument()
      expect(sendButton()).toBeEnabled()
      expect(sendButton()).not.toHaveAttribute('aria-busy', 'true')

      vi.mocked(sendReceipt).mockResolvedValueOnce(pending)
      await user.click(sendButton())

      expect(await screen.findByRole('status')).toHaveTextContent('Enviaste el comprobante.')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
