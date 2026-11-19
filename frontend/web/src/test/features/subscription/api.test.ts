import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/http', () => ({ apiFetch: vi.fn(), apiFetchBlob: vi.fn() }))

import { apiFetch, apiFetchBlob } from '../../../lib/http'
import { fetchReceiptFile, fetchReceipts, fetchSubscription, sendReceipt } from '../../../features/subscription/api/client'
import { comprobantePendiente, suscripcion } from '../../fixtures/subscription/fixtures'

describe('subscription api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('fetchSubscription GETs the summary and returns it', async () => {
    const summary = suscripcion()
    vi.mocked(apiFetch).mockResolvedValue(summary)

    await expect(fetchSubscription()).resolves.toEqual(summary)
    expect(apiFetch).toHaveBeenCalledWith('/api/concesionaria/suscripcion')
  })

  it('fetches the signed-in dealership history and uses its private file endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValue([])
    await expect(fetchReceipts()).resolves.toEqual([])
    expect(apiFetch).toHaveBeenCalledWith('/api/concesionaria/suscripcion/comprobantes')
    const blob = new Blob(['receipt'])
    vi.mocked(apiFetchBlob).mockResolvedValue(blob)
    await expect(fetchReceiptFile(7)).resolves.toBe(blob)
    expect(apiFetchBlob).toHaveBeenCalledWith('/api/concesionaria/suscripcion/comprobantes/7/archivo')
  })

  it('sendReceipt POSTs the file as the comprobante field and returns the new summary', async () => {
    const updated = suscripcion({ comprobante_pendiente: comprobantePendiente() })
    vi.mocked(apiFetch).mockResolvedValue(updated)
    const file = new File(['x'], 'comprobante.pdf', { type: 'application/pdf' })

    await expect(sendReceipt(file)).resolves.toEqual(updated)

    const [path, options] = vi.mocked(apiFetch).mock.calls[0]
    expect(path).toBe('/api/concesionaria/suscripcion/comprobantes')
    expect(options?.method).toBe('POST')
    expect(options?.body).toBeInstanceOf(FormData)
    expect((options?.body as FormData).getAll('comprobante')).toEqual([file])
  })

  it('lets the errors of apiFetch propagate', async () => {
    const failure = new Error('HTTP 500')
    vi.mocked(apiFetch).mockRejectedValue(failure)

    await expect(fetchSubscription()).rejects.toBe(failure)
    await expect(sendReceipt(new File(['x'], 'a.pdf'))).rejects.toBe(failure)
  })
})
