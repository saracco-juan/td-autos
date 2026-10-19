import { fetchInspection, finishInspection, setItemCompleted } from '../../../features/inspection/api'
import { inspectionResponse } from '@shared/checklist/inspection/fixtures'

describe('inspection api', () => {
  it('fetches the checklist of the vehicle', async () => {
    const response = inspectionResponse()
    const request = jest.fn().mockResolvedValue(response)

    await expect(fetchInspection(request, 7)).resolves.toEqual(response)
    expect(request).toHaveBeenCalledWith('/api/vehiculos/7/inspeccion')
  })

  it('saves one item with PUT and an encoded code', async () => {
    const progress = { estado: 'en_curso', items_completados: ['a b'] }
    const request = jest.fn().mockResolvedValue(progress)

    await expect(setItemCompleted(request, 7, 'a b', true)).resolves.toEqual(progress)
    expect(request).toHaveBeenCalledWith('/api/vehiculos/7/inspeccion/items/a%20b', {
      method: 'PUT',
      body: { completado: true },
    })
  })

  it('finishes the inspection with POST', async () => {
    const progress = { estado: 'completa', items_completados: [] }
    const request = jest.fn().mockResolvedValue(progress)

    await expect(finishInspection(request, 7)).resolves.toEqual(progress)
    expect(request).toHaveBeenCalledWith('/api/vehiculos/7/inspeccion/finalizar', { method: 'POST' })
  })

  it('propagates request failures', async () => {
    const request = jest.fn().mockRejectedValue(new Error('boom'))

    await expect(setItemCompleted(request, 7, 'papeles_vtv', false)).rejects.toThrow('boom')
  })
})
