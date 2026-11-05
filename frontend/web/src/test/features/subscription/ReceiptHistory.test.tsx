import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReceiptHistory from '../../../features/subscription/components/ReceiptHistory'
import { fetchReceiptFile, fetchReceipts } from '../../../features/subscription/api/client'
import type { ReceiptHistoryEntry } from '../../../features/subscription/model/types'
import { HttpError } from '../../../lib/http'

vi.mock('../../../features/subscription/api/client', () => ({ fetchReceipts: vi.fn(), fetchReceiptFile: vi.fn() }))

const entry = (id = 1, overrides: Partial<ReceiptHistoryEntry> = {}): ReceiptHistoryEntry => ({
  id, nombre_archivo: `pago-${id}.pdf`, periodo_desde: '2026-10-01', periodo_hasta: '2026-11-01',
  enviado_en: '2026-10-01T12:00:00Z', estado: 'aprobado', fecha_revision: '2026-10-02T12:00:00Z',
  motivo_rechazo: null, ...overrides,
})

describe('dealership receipt history', () => {
  beforeEach(() => {
    vi.mocked(fetchReceipts).mockReset()
    vi.mocked(fetchReceiptFile).mockReset()
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } },
      close: { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } },
    })
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('explains an empty history instead of inventing receipts', async () => {
    vi.mocked(fetchReceipts).mockResolvedValue([])
    render(<ReceiptHistory revision={null} />)
    expect(await screen.findByText('Todavía no enviaste comprobantes.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /DESCARGAR/ })).not.toBeInTheDocument()
  })

  it('shows periods, filenames, review outcomes and rejection reasons', async () => {
    vi.mocked(fetchReceipts).mockResolvedValue([
      entry(3, { estado: 'pendiente de revisión', fecha_revision: null }),
      entry(2, { estado: 'rechazado', motivo_rechazo: 'El monto no coincide.' }), entry(),
    ])
    render(<ReceiptHistory revision={3} />)
    const list = within(await screen.findByRole('region', { name: 'Comprobantes enviados' })).getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Pendiente de revisión')).toBeInTheDocument()
    expect(screen.getByText('Rechazado')).toBeInTheDocument()
    expect(screen.getByText('Aprobado')).toBeInTheDocument()
    expect(screen.getByText('Motivo: El monto no coincide.')).toBeInTheDocument()
    expect(within(list).getAllByText('Período: 01/10/2026 al 01/11/2026')).toHaveLength(3)
  })

  it('paginates receipts and changes the page size without losing entries', async () => {
    vi.mocked(fetchReceipts).mockResolvedValue(Array.from({ length: 11 }, (_, i) => entry(11 - i)))
    render(<ReceiptHistory revision={null} />)
    expect(await screen.findByText('pago-11.pdf')).toBeInTheDocument()
    expect(screen.queryByText('pago-1.pdf')).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(screen.getByText('pago-1.pdf')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), '25')
    expect(screen.getByText('pago-11.pdf')).toBeInTheDocument()
    expect(screen.getByText('pago-1.pdf')).toBeInTheDocument()
  })

  it('isolates a history failure and retries only the list', async () => {
    vi.mocked(fetchReceipts).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([entry()])
    render(<ReceiptHistory revision={null} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Podés seguir gestionando tu suscripción.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR HISTORIAL' }))
    expect(await screen.findByText('pago-1.pdf')).toBeInTheDocument()
  })

  it('refreshes after a new receipt is submitted', async () => {
    vi.mocked(fetchReceipts).mockResolvedValueOnce([]).mockResolvedValueOnce([entry(2)])
    const view = render(<ReceiptHistory revision={null} />)
    await screen.findByText('Todavía no enviaste comprobantes.')
    view.rerender(<ReceiptHistory revision={2} />)
    expect(await screen.findByText('pago-2.pdf')).toBeInTheDocument()
  })

  it('returns to the first page so a newly submitted receipt is visible', async () => {
    const previous = Array.from({ length: 11 }, (_, index) => entry(11 - index))
    vi.mocked(fetchReceipts).mockResolvedValueOnce(previous).mockResolvedValueOnce([entry(12), ...previous])
    const view = render(<ReceiptHistory revision={null} />)
    await screen.findByText('pago-11.pdf')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(screen.getByText('pago-1.pdf')).toBeInTheDocument()
    view.rerender(<ReceiptHistory revision={12} />)
    expect(await screen.findByText('pago-12.pdf')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Página 1$/ })).toHaveAttribute('aria-current', 'page')
  })

  it('uses the private file endpoint and releases the download URL on unmount', async () => {
    vi.mocked(fetchReceipts).mockResolvedValue([entry()])
    vi.mocked(fetchReceiptFile).mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))
    const NativeURL = URL
    const revoke = vi.fn()
    vi.stubGlobal('URL', class extends NativeURL {
      static createObjectURL = vi.fn(() => 'blob:receipt-test')
      static revokeObjectURL = revoke
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const view = render(<ReceiptHistory revision={null} />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'DESCARGAR pago-1.pdf' }))
    expect(fetchReceiptFile).toHaveBeenCalledWith(1)
    expect(click).toHaveBeenCalledOnce()
    view.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:receipt-test')
  })

  it('explains a missing stored file without discarding the history', async () => {
    vi.mocked(fetchReceipts).mockResolvedValue([entry()])
    vi.mocked(fetchReceiptFile).mockRejectedValue(new HttpError(404, {}))
    render(<ReceiptHistory revision={null} />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'DESCARGAR pago-1.pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo no está disponible.')
    expect(screen.getByText('pago-1.pdf')).toBeInTheDocument()
  })

  it.each(['image/jpeg', 'image/png', 'application/pdf'])('previews a private %s and releases its URL on close', async (type) => {
    vi.mocked(fetchReceipts).mockResolvedValue([entry()])
    vi.mocked(fetchReceiptFile).mockResolvedValue(new Blob(['receipt'], { type }))
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-preview')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<ReceiptHistory revision={null} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'VER pago-1.pdf' }))
    const dialog = await screen.findByRole('dialog', { name: 'pago-1.pdf' })
    const preview = type === 'application/pdf'
      ? within(dialog).getByTitle('pago-1.pdf') : within(dialog).getByRole('img', { name: 'pago-1.pdf' })
    expect(preview).toHaveAttribute('src', 'blob:private-preview')
    expect(fetchReceiptFile).toHaveBeenCalledWith(1)
    expect(click).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'CERRAR' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(revoke).toHaveBeenCalledWith('blob:private-preview')
    await waitFor(() => expect(screen.getByRole('button', { name: 'VER pago-1.pdf' })).toHaveFocus())
    expect(screen.getByRole('button', { name: 'DESCARGAR pago-1.pdf' })).toBeEnabled()
  })

  it('keeps download available when the private preview fails', async () => {
    vi.mocked(fetchReceipts).mockResolvedValue([entry()])
    vi.mocked(fetchReceiptFile).mockRejectedValue(new HttpError(404, {}))
    render(<ReceiptHistory revision={null} />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'VER pago-1.pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo no está disponible.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DESCARGAR pago-1.pdf' })).toBeEnabled()
  })
})
