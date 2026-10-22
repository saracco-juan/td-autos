import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn(), apiFetchBlob: vi.fn() }))

import { apiFetch, apiFetchBlob } from '../../lib/http'
import { approveReceipt, deleteDealer, fetchDealer, fetchDealerDirectory, fetchReceipt, fetchReceiptFile, rejectReceipt, updateDealer } from './api'
import { dealerDetail, directory, receipt } from './fixtures'

describe('admin api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetchBlob).mockReset()
  })

  it('fetchDealerDirectory GETs the dealers with their counts', async () => {
    const summary = directory()
    vi.mocked(apiFetch).mockResolvedValue(summary)

    await expect(fetchDealerDirectory()).resolves.toEqual(summary)
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/concesionarias')
  })

  it('fetchReceipt GETs the receipt detail', async () => {
    vi.mocked(apiFetch).mockResolvedValue(receipt())

    await expect(fetchReceipt(31)).resolves.toEqual(receipt())
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/comprobantes/31')
  })

  it('fetchReceiptFile asks the authenticated file route for a Blob', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    vi.mocked(apiFetchBlob).mockResolvedValue(blob)

    await expect(fetchReceiptFile(31)).resolves.toBe(blob)
    expect(apiFetchBlob).toHaveBeenCalledWith('/api/admin/comprobantes/31/archivo')
  })

  it('approveReceipt POSTs to aprobar and returns the decided receipt', async () => {
    const approved = receipt({ estado: 'aprobado' })
    vi.mocked(apiFetch).mockResolvedValue(approved)

    await expect(approveReceipt(31)).resolves.toEqual(approved)
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/comprobantes/31/aprobar', { method: 'POST' })
  })

  it('rejectReceipt POSTs the reason to rechazar and returns the decided receipt', async () => {
    const rejected = receipt({ estado: 'rechazado', motivo_rechazo: 'El monto no coincide.' })
    vi.mocked(apiFetch).mockResolvedValue(rejected)

    await expect(rejectReceipt(31, 'El monto no coincide.')).resolves.toEqual(rejected)
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/comprobantes/31/rechazar', {
      method: 'POST',
      body: { motivo_rechazo: 'El monto no coincide.' },
    })
  })

  it('fetchDealer GETs the dealer detail', async () => {
    vi.mocked(apiFetch).mockResolvedValue(dealerDetail())

    await expect(fetchDealer(5)).resolves.toEqual(dealerDetail())
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/concesionarias/5')
  })

  it('updateDealer PUTs the editable data and returns the dealer as it is after saving', async () => {
    const saved = dealerDetail({ nombre: 'Sur Motors' })
    const { id, estado_alta, suscripcion, comprobantes, puede_eliminarse, ...values } = saved
    void [id, estado_alta, suscripcion, comprobantes, puede_eliminarse]
    vi.mocked(apiFetch).mockResolvedValue(saved)

    await expect(updateDealer(5, values)).resolves.toEqual(saved)
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/concesionarias/5', { method: 'PUT', body: values })
  })

  it('deleteDealer DELETEs the dealer and resolves with nothing (204)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined)

    await expect(deleteDealer(5)).resolves.toBeUndefined()
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/concesionarias/5', { method: 'DELETE' })
  })

  it('lets the errors of apiFetch propagate', async () => {
    const failure = new Error('HTTP 500')
    vi.mocked(apiFetch).mockRejectedValue(failure)

    await expect(fetchDealerDirectory()).rejects.toBe(failure)
    await expect(fetchReceipt(31)).rejects.toBe(failure)
    await expect(approveReceipt(31)).rejects.toBe(failure)
    await expect(rejectReceipt(31, 'x')).rejects.toBe(failure)
    await expect(fetchDealer(5)).rejects.toBe(failure)
    await expect(updateDealer(5, dealerDetail())).rejects.toBe(failure)
    await expect(deleteDealer(5)).rejects.toBe(failure)
  })
})
