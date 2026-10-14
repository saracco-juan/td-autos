import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn(), apiFetchBlob: vi.fn() }))

import { apiFetch, apiFetchBlob } from '../../lib/http'
import { approveReceipt, fetchDealerDirectory, fetchReceipt, fetchReceiptFile, rejectReceipt } from './api'
import { directory, receipt } from './fixtures'

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

  it('lets the errors of apiFetch propagate', async () => {
    const failure = new Error('HTTP 500')
    vi.mocked(apiFetch).mockRejectedValue(failure)

    await expect(fetchDealerDirectory()).rejects.toBe(failure)
    await expect(fetchReceipt(31)).rejects.toBe(failure)
    await expect(approveReceipt(31)).rejects.toBe(failure)
    await expect(rejectReceipt(31, 'x')).rejects.toBe(failure)
  })
})
