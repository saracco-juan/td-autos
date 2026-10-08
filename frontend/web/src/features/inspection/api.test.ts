import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '../../lib/http'
import { fetchInspection, finishInspection, setItemCompleted } from './api'
import type { InspectionProgress, InspectionResponse } from './types'

const inspection: InspectionResponse = {
  vehiculo: { id: 7, marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021 },
  estado: 'en_curso',
  pasos: [
    {
      numero: 1,
      titulo: 'Papeles',
      ayuda: null,
      items: [{ codigo: 'papeles_titular', texto: 'El titular coincide', critico: true }],
    },
  ],
  items_completados: ['papeles_titular'],
}

const progress: InspectionProgress = { estado: 'incompleta', items_completados: ['papeles_titular'] }

describe('inspection api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('fetchInspection GETs the vehicle checklist and returns it as is', async () => {
    vi.mocked(apiFetch).mockResolvedValue(inspection)

    await expect(fetchInspection(7)).resolves.toEqual(inspection)
    expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/7/inspeccion')
  })

  // TC-35
  it('setItemCompleted PUTs the mark of one item and returns the progress', async () => {
    vi.mocked(apiFetch).mockResolvedValue(progress)

    await expect(setItemCompleted(7, 'papeles_titular', true)).resolves.toEqual(progress)
    expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/7/inspeccion/items/papeles_titular', {
      method: 'PUT',
      body: { completado: true },
    })
  })

  it('setItemCompleted sends completado false to untick an item', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ estado: 'en_curso', items_completados: [] })

    await setItemCompleted(7, 'papeles_titular', false)
    expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/7/inspeccion/items/papeles_titular', {
      method: 'PUT',
      body: { completado: false },
    })
  })

  it('setItemCompleted encodes the item code in the URL', async () => {
    vi.mocked(apiFetch).mockResolvedValue(progress)

    await setItemCompleted(7, 'a/b c', true)
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toBe('/api/vehiculos/7/inspeccion/items/a%2Fb%20c')
  })

  // TC-35, TC-37
  it('finishInspection POSTs to finalizar and returns the progress', async () => {
    vi.mocked(apiFetch).mockResolvedValue(progress)

    await expect(finishInspection(7)).resolves.toEqual(progress)
    expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/7/inspeccion/finalizar', { method: 'POST' })
  })

  it('lets the errors of apiFetch propagate', async () => {
    const failure = new Error('HTTP 404')
    vi.mocked(apiFetch).mockRejectedValue(failure)

    await expect(fetchInspection(9)).rejects.toBe(failure)
    await expect(setItemCompleted(9, 'papeles_titular', true)).rejects.toBe(failure)
    await expect(finishInspection(9)).rejects.toBe(failure)
  })
})
