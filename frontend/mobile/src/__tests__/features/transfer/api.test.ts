import { transferResponse } from '@shared/checklist/transfer/fixtures'
import { fetchTransfer, finishTransfer, setItemCompleted } from '../../../features/transfer/api'

describe('transfer api', () => {
  it('fetches the checklist of the user', async () => {
    const response = transferResponse()
    const request = jest.fn().mockResolvedValue(response)

    await expect(fetchTransfer(request)).resolves.toEqual(response)
    expect(request).toHaveBeenCalledWith('/api/transferencia')
  })

  it('saves one item with PUT and an encoded code', async () => {
    const progress = { estado: 'en_curso', items_completados: ['a b'] }
    const request = jest.fn().mockResolvedValue(progress)

    await expect(setItemCompleted(request, 'a b', true)).resolves.toEqual(progress)
    expect(request).toHaveBeenCalledWith('/api/transferencia/items/a%20b', {
      method: 'PUT',
      body: { completado: true },
    })
  })

  it('finishes the checklist with POST', async () => {
    const progress = { estado: 'completa', items_completados: [] }
    const request = jest.fn().mockResolvedValue(progress)

    await expect(finishTransfer(request)).resolves.toEqual(progress)
    expect(request).toHaveBeenCalledWith('/api/transferencia/finalizar', { method: 'POST' })
  })

  it('propagates request failures', async () => {
    const request = jest.fn().mockRejectedValue(new Error('boom'))

    await expect(setItemCompleted(request, 'documentacion_dni', false)).rejects.toThrow('boom')
  })
})
