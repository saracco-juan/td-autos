import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { approveReceipt, fetchReceipt, fetchReceiptFile, rejectReceipt } from './api'
import { receipt } from './fixtures'
import ReceiptReviewPage from './ReceiptReviewPage'

vi.mock('./api', () => ({
  fetchReceipt: vi.fn(),
  fetchReceiptFile: vi.fn(),
  approveReceipt: vi.fn(),
  rejectReceipt: vi.fn(),
}))

const APPROVE = 'APROBAR COMPROBANTE'
const REJECT = 'RECHAZAR COMPROBANTE'
const REASON = 'Motivo de rechazo (obligatorio para rechazar)'

const approved = receipt({
  estado: 'aprobado',
  fecha_revision: '2026-10-15T13:00:00+00:00',
  concesionaria: { ...receipt().concesionaria, estado_alta: 'activa' },
})
const rejected = receipt({
  estado: 'rechazado',
  motivo_rechazo: 'El monto no coincide con la cuota.',
  fecha_revision: '2026-10-15T13:00:00+00:00',
})

// Moves to another receipt without unmounting the page, like a link to another receipt would.
function GoToReceipt({ id }: { id: number }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => void navigate(`/admin/comprobantes/${id}`)}>
      Ir al comprobante {id}
    </button>
  )
}

function renderPage(id = '31') {
  render(
    <MemoryRouter initialEntries={[`/admin/comprobantes/${id}`]}>
      <GoToReceipt id={45} />
      <Routes>
        <Route path="/admin/comprobantes/:id" element={<ReceiptReviewPage />} />
        <Route path="/admin/concesionarias" element={<p>Lista de concesionarias</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function loaded() {
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Revisar comprobante' })
}

const card = (name: string) => within(screen.getByRole('region', { name }))

describe('ReceiptReviewPage (UH19, Figma 38:1129)', () => {
  beforeEach(() => {
    vi.mocked(fetchReceipt).mockReset()
    vi.mocked(fetchReceiptFile).mockReset()
    vi.mocked(approveReceipt).mockReset()
    vi.mocked(rejectReceipt).mockReset()
    vi.mocked(fetchReceipt).mockResolvedValue(receipt())
    vi.mocked(fetchReceiptFile).mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:receipt-31'), revokeObjectURL: vi.fn() }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('loading', () => {
    it('shows a loader while the receipt loads, and asks for the receipt of the URL', () => {
      vi.mocked(fetchReceipt).mockReturnValue(new Promise(() => {}))
      renderPage('44')

      expect(screen.getByRole('status')).toHaveTextContent('Cargando')
      expect(fetchReceipt).toHaveBeenCalledWith(44)
    })

    it.each([
      ['a network failure', new NetworkError(new TypeError('Failed to fetch')), 'Sin conexión con el servidor'],
      ['a server failure', new HttpError(500, undefined), 'Algo salió mal'],
    ])('shows the error state after %s, and REINTENTAR loads the receipt', async (_label, failure, title) => {
      vi.mocked(fetchReceipt).mockRejectedValueOnce(failure)
      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(title)
      await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Revisar comprobante' })).toBeInTheDocument()
    })

    it('tells a missing receipt apart and links back to the dealer list', async () => {
      vi.mocked(fetchReceipt).mockRejectedValue(new HttpError(404, { message: 'Not found' }))
      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos el comprobante.')
      expect(screen.getByRole('link', { name: 'Volver a concesionarias' })).toHaveAttribute('href', '/admin/concesionarias')
    })
  })

  describe('detail', () => {
    it('shows the Figma header and the back link to the dealer list', async () => {
      await loaded()

      expect(screen.getByText('CONCESIONARIAS')).toBeInTheDocument()
      expect(screen.getByText('Revisión del registro seleccionado.')).toBeInTheDocument()
      expect(screen.getAllByRole('link', { name: /volver a concesionarias/i })[0]).toHaveAttribute('href', '/admin/concesionarias')
    })

    it.each([
      ['inactiva', 'Inactiva', 'Suscripción vencida', 'rejected'],
      ['gracia', 'Activa', 'En período de gracia', 'warning'],
    ] as const)('UH-20: shows an active dealer with a %s subscription as %s with the %s tag', async (estado, label, tag, tone) => {
      vi.mocked(fetchReceipt).mockResolvedValue(
        receipt({ estado: 'aprobado', concesionaria: { ...receipt().concesionaria, estado_alta: 'activa', suscripcion_estado: estado } }),
      )
      await loaded()

      expect(card('Estado de la concesionaria').getByText(label)).toBeInTheDocument()
      expect(card('Estado de la concesionaria').getByText(tag)).toHaveAttribute('data-tone', tone)
    })

    it('shows no tag for a dealer whose subscription is in force', async () => {
      vi.mocked(fetchReceipt).mockResolvedValue(
        receipt({ concesionaria: { ...receipt().concesionaria, estado_alta: 'activa', suscripcion_estado: 'activa' } }),
      )
      await loaded()

      expect(card('Estado de la concesionaria').getByText('Activa')).toBeInTheDocument()
      expect(card('Estado de la concesionaria').queryByText(/vencida|gracia/)).not.toBeInTheDocument()
    })

    it('shows the dealer, contact, dealer state, receipt state and the paid period', async () => {
      await loaded()

      expect(card('Concesionaria').getByText('Concesionaria Sur · CABA')).toBeInTheDocument()
      expect(card('Contacto').getByText('sur@example.com · 11 4000-0000')).toBeInTheDocument()
      expect(card('Estado de la concesionaria').getByText('Pendiente de aprobación')).toBeInTheDocument()
      expect(card('Estado del comprobante').getByText('Pendiente de revisión')).toBeInTheDocument()
      expect(card('Período').getByText('Alta · 14/10/2026 al 13/11/2026')).toBeInTheDocument()
    })

    it('names a renewal receipt as such', async () => {
      vi.mocked(fetchReceipt).mockResolvedValue(receipt({ tipo: 'renovacion' }))
      await loaded()

      expect(card('Período').getByText('Renovación · 14/10/2026 al 13/11/2026')).toBeInTheDocument()
    })
  })

  describe('file preview', () => {
    it('loads the file through the authenticated route and shows an image receipt', async () => {
      await loaded()

      const preview = card('Comprobante de pago')
      expect(await preview.findByRole('img', { name: 'Comprobante de pago' })).toHaveAttribute('src', 'blob:receipt-31')
      expect(fetchReceiptFile).toHaveBeenCalledWith(31)
      expect(preview.getByText('COMPROBANTE DE TRANSFERENCIA')).toBeInTheDocument()
    })

    it('shows a PDF receipt in a frame', async () => {
      vi.mocked(fetchReceiptFile).mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
      await loaded()

      expect(await screen.findByTitle('Comprobante de pago')).toHaveAttribute('src', 'blob:receipt-31')
    })

    it('offers to open the file in a new tab', async () => {
      await loaded()

      const open = await screen.findByRole('link', { name: 'Abrir pago-octubre.pdf' })
      expect(open).toHaveAttribute('href', 'blob:receipt-31')
      expect(open).toHaveAttribute('target', '_blank')
      expect(open).not.toHaveAttribute('download')
    })

    it('offers to open a PDF receipt in a new tab', async () => {
      vi.mocked(fetchReceiptFile).mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
      await loaded()

      expect(await screen.findByRole('link', { name: 'Abrir pago-octubre.pdf' })).toHaveAttribute('target', '_blank')
    })

    it.each([
      ['an SVG image', 'image/svg+xml'],
      ['an HTML document', 'text/html'],
      ['a file without a type', ''],
    ])('never opens %s in the app: no preview, only a download of an inert copy', async (_label, type) => {
      vi.mocked(fetchReceiptFile).mockResolvedValue(new Blob(['<svg onload="alert(1)"/>'], { type }))
      await loaded()

      const download = await screen.findByRole('link', { name: 'Descargar pago-octubre.pdf' })
      expect(download).toHaveAttribute('href', 'blob:receipt-31')
      expect(download).toHaveAttribute('download', 'pago-octubre.pdf')
      expect(download).not.toHaveAttribute('target')
      expect(screen.queryByRole('link', { name: /^Abrir/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('img', { name: 'Comprobante de pago' })).not.toBeInTheDocument()
      expect(screen.queryByTitle('Comprobante de pago')).not.toBeInTheDocument()
      const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob
      expect(blob.type).toBe('application/octet-stream')
    })

    it('says the file could not be loaded, and the decision can still be made', async () => {
      vi.mocked(fetchReceiptFile).mockRejectedValue(new HttpError(404, { message: 'No encontramos el archivo del comprobante.' }))
      await loaded()

      expect(await card('Comprobante de pago').findByText('No pudimos cargar el archivo del comprobante.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: APPROVE })).toBeEnabled()
    })

    it('releases the file URL when leaving the page', async () => {
      await loaded()
      await screen.findByRole('img', { name: 'Comprobante de pago' })

      await userEvent.setup().click(screen.getAllByRole('link', { name: /volver a concesionarias/i })[0])

      expect(screen.getByText('Lista de concesionarias')).toBeInTheDocument()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt-31')
    })
  })

  describe('approve (TC-49)', () => {
    it('approves the receipt, shows the result and the new states, and hides the actions', async () => {
      vi.mocked(approveReceipt).mockResolvedValue(approved)
      await loaded()

      await userEvent.setup().click(screen.getByRole('button', { name: APPROVE }))

      expect(await screen.findByRole('status')).toHaveTextContent('Aprobaste el comprobante. Le avisamos a la concesionaria por email.')
      expect(approveReceipt).toHaveBeenCalledWith(31)
      expect(card('Estado del comprobante').getByText('Aprobado')).toBeInTheDocument()
      expect(card('Estado de la concesionaria').getByText('Activa')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: APPROVE })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: REJECT })).not.toBeInTheDocument()
      expect(screen.queryByLabelText(REASON)).not.toBeInTheDocument()
    })

    it('disables both decisions and the reason while the approval is sent', async () => {
      vi.mocked(approveReceipt).mockReturnValue(new Promise(() => {}))
      await loaded()

      await userEvent.setup().click(screen.getByRole('button', { name: APPROVE }))

      expect(screen.getByRole('button', { name: APPROVE })).toBeDisabled()
      expect(screen.getByRole('button', { name: APPROVE })).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('button', { name: REJECT })).toBeDisabled()
      expect(screen.getByLabelText(REASON)).toBeDisabled()
    })

    it('shows a generic error and keeps the actions when the approval fails', async () => {
      vi.mocked(approveReceipt).mockRejectedValue(new HttpError(500, undefined))
      await loaded()

      await userEvent.setup().click(screen.getByRole('button', { name: APPROVE }))

      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar la decisión. Intentá nuevamente.')
      expect(screen.getByRole('button', { name: APPROVE })).toBeEnabled()
    })
  })

  describe('reject', () => {
    it('TC-50: blocks a rejection without a reason, with the message on the field', async () => {
      await loaded()

      await userEvent.setup().click(screen.getByRole('button', { name: REJECT }))

      expect(rejectReceipt).not.toHaveBeenCalled()
      const field = screen.getByLabelText(REASON)
      expect(field).toHaveAccessibleDescription('Ingresá el motivo del rechazo.')
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(card('Estado del comprobante').getByText('Pendiente de revisión')).toBeInTheDocument()
    })

    it('TC-50: blocks a reason made only of spaces', async () => {
      await loaded()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText(REASON), '    ')
      await user.click(screen.getByRole('button', { name: REJECT }))

      expect(rejectReceipt).not.toHaveBeenCalled()
      expect(screen.getByLabelText(REASON)).toHaveAccessibleDescription('Ingresá el motivo del rechazo.')
    })

    it('blocks a reason longer than 500 characters', async () => {
      await loaded()
      const user = userEvent.setup()

      await user.click(screen.getByLabelText(REASON))
      await user.paste('a'.repeat(501))
      await user.click(screen.getByRole('button', { name: REJECT }))

      expect(rejectReceipt).not.toHaveBeenCalled()
      expect(screen.getByLabelText(REASON)).toHaveAccessibleDescription('El motivo no puede superar los 500 caracteres.')
    })

    it('clears the field error once the reason is edited', async () => {
      await loaded()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: REJECT }))

      await user.type(screen.getByLabelText(REASON), 'E')

      expect(screen.getByLabelText(REASON)).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('TC-51: rejects with the trimmed reason, shows the result and the stored reason, and hides the actions', async () => {
      vi.mocked(rejectReceipt).mockResolvedValue(rejected)
      await loaded()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText(REASON), '  El monto no coincide con la cuota.  ')
      await user.click(screen.getByRole('button', { name: REJECT }))

      expect(await screen.findByRole('status')).toHaveTextContent('Rechazaste el comprobante. Le avisamos a la concesionaria por email.')
      expect(rejectReceipt).toHaveBeenCalledWith(31, 'El monto no coincide con la cuota.')
      expect(card('Estado del comprobante').getByText('Rechazado')).toHaveAttribute('data-tone', 'rejected')
      expect(card('Comprobante rechazado').getByText('El monto no coincide con la cuota.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: REJECT })).not.toBeInTheDocument()
      expect(screen.queryByLabelText(REASON)).not.toBeInTheDocument()
    })

    it('shows the server validation message on the field (422)', async () => {
      vi.mocked(rejectReceipt).mockRejectedValue(
        new HttpError(422, { message: 'x', errors: { motivo_rechazo: ['El motivo no puede superar los 500 caracteres.'] } }),
      )
      await loaded()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText(REASON), 'Motivo')
      await user.click(screen.getByRole('button', { name: REJECT }))

      await waitFor(() =>
        expect(screen.getByLabelText(REASON)).toHaveAccessibleDescription('El motivo no puede superar los 500 caracteres.'),
      )
      expect(screen.getByRole('button', { name: REJECT })).toBeEnabled()
    })

    it('disables both decisions while the rejection is sent', async () => {
      vi.mocked(rejectReceipt).mockReturnValue(new Promise(() => {}))
      await loaded()
      const user = userEvent.setup()

      await user.type(screen.getByLabelText(REASON), 'Motivo')
      await user.click(screen.getByRole('button', { name: REJECT }))

      expect(screen.getByRole('button', { name: REJECT })).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('button', { name: REJECT })).toBeDisabled()
      expect(screen.getByRole('button', { name: APPROVE })).toBeDisabled()
    })
  })

  describe('already decided', () => {
    it('409: shows the message and reloads the receipt, which opens read-only', async () => {
      vi.mocked(approveReceipt).mockRejectedValue(new HttpError(409, { message: 'Este comprobante ya fue revisado.' }))
      vi.mocked(fetchReceipt).mockResolvedValueOnce(receipt()).mockResolvedValueOnce(rejected)
      await loaded()

      await userEvent.setup().click(screen.getByRole('button', { name: APPROVE }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Este comprobante ya fue revisado.')
      expect(await card('Estado del comprobante').findByText('Rechazado')).toBeInTheDocument()
      expect(fetchReceipt).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('button', { name: APPROVE })).not.toBeInTheDocument()
    })

    it('opens an approved receipt read-only, with the decision date', async () => {
      vi.mocked(fetchReceipt).mockResolvedValue(approved)
      await loaded()

      expect(card('Comprobante aprobado').getByText(/Aprobado el \d{2}\/10\/2026/)).toBeInTheDocument()
      expect(card('Estado del comprobante').getByText('Aprobado')).toHaveAttribute('data-tone', 'approved')
      expect(screen.queryByRole('button', { name: APPROVE })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: REJECT })).not.toBeInTheDocument()
      expect(screen.queryByLabelText(REASON)).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('opens a rejected receipt read-only, with its reason', async () => {
      vi.mocked(fetchReceipt).mockResolvedValue(rejected)
      await loaded()

      const banner = screen.getByRole('region', { name: 'Comprobante rechazado' })
      expect(within(banner).getByText(/Rechazado el \d{2}\/10\/2026/)).toBeInTheDocument()
      expect(within(banner).getByText('El monto no coincide con la cuota.')).toBeInTheDocument()
      // The outcome sits at the top, before the data cards.
      expect(banner.compareDocumentPosition(screen.getByRole('region', { name: 'Concesionaria' }))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(card('Estado del comprobante').getByText('Rechazado')).toHaveAttribute('data-tone', 'rejected')
    })

    it('shows no outcome banner while the receipt is pending', async () => {
      await loaded()

      expect(screen.queryByRole('region', { name: /Comprobante (rechazado|aprobado)/ })).not.toBeInTheDocument()
      expect(card('Estado del comprobante').getByText('Pendiente de revisión')).toHaveAttribute('data-tone', 'pending')
    })
  })

  describe('another receipt on the same page', () => {
    const other = receipt({
      id: 45,
      nombre_archivo: 'pago-noviembre.pdf',
      concesionaria: { ...receipt().concesionaria, nombre: 'Autos Norte' },
    })

    it('drops the previous receipt, its reason and its result while the new one loads', async () => {
      vi.mocked(approveReceipt).mockResolvedValue(approved)
      vi.mocked(fetchReceipt).mockImplementation((id) => (id === 31 ? Promise.resolve(receipt()) : new Promise(() => {})))
      await loaded()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: APPROVE }))
      await screen.findByText('Aprobaste el comprobante. Le avisamos a la concesionaria por email.')

      await user.click(screen.getByRole('button', { name: 'Ir al comprobante 45' }))

      expect(fetchReceipt).toHaveBeenLastCalledWith(45)
      expect(screen.getByRole('status')).toHaveTextContent('Cargando')
      expect(screen.queryByRole('heading', { level: 1, name: 'Revisar comprobante' })).not.toBeInTheDocument()
      expect(screen.queryByText('Concesionaria Sur · CABA')).not.toBeInTheDocument()
      expect(screen.queryByText(/Aprobaste el comprobante/)).not.toBeInTheDocument()
    })

    it('decides on the receipt shown, with a clean reason field', async () => {
      vi.mocked(fetchReceipt).mockImplementation((id) => Promise.resolve(id === 31 ? receipt() : other))
      vi.mocked(rejectReceipt).mockResolvedValue({ ...other, estado: 'rechazado', motivo_rechazo: 'Ilegible.' })
      await loaded()
      const user = userEvent.setup()
      await user.type(screen.getByLabelText(REASON), 'Motivo del anterior')

      await user.click(screen.getByRole('button', { name: 'Ir al comprobante 45' }))

      expect(await screen.findByText('Autos Norte · CABA')).toBeInTheDocument()
      expect(screen.getByLabelText(REASON)).toHaveValue('')
      await user.type(screen.getByLabelText(REASON), 'Ilegible.')
      await user.click(screen.getByRole('button', { name: REJECT }))

      expect(await screen.findByRole('status')).toHaveTextContent('Rechazaste el comprobante.')
      expect(rejectReceipt).toHaveBeenCalledWith(45, 'Ilegible.')
      expect(rejectReceipt).not.toHaveBeenCalledWith(31, expect.anything())
    })

    it('ignores the answer of a decision sent for the previous receipt', async () => {
      let answer: (value: typeof approved) => void = () => {}
      vi.mocked(approveReceipt).mockReturnValue(new Promise((resolve) => (answer = resolve)))
      vi.mocked(fetchReceipt).mockImplementation((id) => Promise.resolve(id === 31 ? receipt() : other))
      await loaded()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: APPROVE }))
      await user.click(screen.getByRole('button', { name: 'Ir al comprobante 45' }))
      await screen.findByText('Autos Norte · CABA')

      answer(approved)

      await waitFor(() => expect(screen.getByRole('button', { name: APPROVE })).toBeEnabled())
      expect(screen.queryByText(/Aprobaste el comprobante/)).not.toBeInTheDocument()
      expect(card('Estado del comprobante').getByText('Pendiente de revisión')).toBeInTheDocument()
    })

    it('approves the receipt it shows, not the one in the address', async () => {
      // The API answers for the receipt id it owns; the decision follows the loaded receipt.
      vi.mocked(fetchReceipt).mockResolvedValue(other)
      vi.mocked(approveReceipt).mockResolvedValue({ ...other, estado: 'aprobado' })
      await loaded()

      await userEvent.setup().click(screen.getByRole('button', { name: APPROVE }))

      await screen.findByText(/Aprobaste el comprobante/)
      expect(approveReceipt).toHaveBeenCalledWith(45)
    })
  })

  it('VOLVER A CONCESIONARIAS goes back to the dealer list', async () => {
    await loaded()

    await userEvent.setup().click(screen.getByRole('link', { name: 'VOLVER A CONCESIONARIAS' }))

    expect(screen.getByText('Lista de concesionarias')).toBeInTheDocument()
  })
})
