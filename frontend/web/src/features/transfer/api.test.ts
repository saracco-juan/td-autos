import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '../../lib/http'
import { fetchTransfer, finishTransfer, setItemCompleted } from './api'
import { transferResponse } from './fixtures'
import type { TransferProgress } from './types'

const progress: TransferProgress = { estado: 'incompleta', items_completados: ['documentacion_dni'] }

describe('transfer api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  // TC-38
  it('fetchTransfer GETs the checklist and returns it as is', async () => {
    const response = transferResponse()
    vi.mocked(apiFetch).mockResolvedValue(response)

    await expect(fetchTransfer()).resolves.toEqual(response)
    expect(apiFetch).toHaveBeenCalledWith('/api/transferencia')
  })

  // TC-39
  it('setItemCompleted PUTs the mark of one item and returns the progress', async () => {
    vi.mocked(apiFetch).mockResolvedValue(progress)

    await expect(setItemCompleted('documentacion_dni', true)).resolves.toEqual(progress)
    expect(apiFetch).toHaveBeenCalledWith('/api/transferencia/items/documentacion_dni', {
      method: 'PUT',
      body: { completado: true },
      keepalive: true,
    })
  })

  it('setItemCompleted sends completado false to untick an item', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ estado: 'en_curso', items_completados: [] })

    await setItemCompleted('documentacion_dni', false)
    expect(apiFetch).toHaveBeenCalledWith('/api/transferencia/items/documentacion_dni', {
      method: 'PUT',
      body: { completado: false },
      keepalive: true,
    })
  })

  it('setItemCompleted encodes the item code in the URL', async () => {
    vi.mocked(apiFetch).mockResolvedValue(progress)

    await setItemCompleted('a/b c', true)
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toBe('/api/transferencia/items/a%2Fb%20c')
  })

  // TC-85
  it('finishTransfer POSTs to finalizar and returns the progress', async () => {
    vi.mocked(apiFetch).mockResolvedValue(progress)

    await expect(finishTransfer()).resolves.toEqual(progress)
    expect(apiFetch).toHaveBeenCalledWith('/api/transferencia/finalizar', { method: 'POST' })
  })

  it('lets the errors of apiFetch propagate', async () => {
    const failure = new Error('HTTP 500')
    vi.mocked(apiFetch).mockRejectedValue(failure)

    await expect(fetchTransfer()).rejects.toBe(failure)
    await expect(setItemCompleted('documentacion_dni', true)).rejects.toBe(failure)
    await expect(finishTransfer()).rejects.toBe(failure)
  })
})
