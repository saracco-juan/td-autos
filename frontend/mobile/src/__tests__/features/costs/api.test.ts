import { fetchCosts } from '../../../features/costs/api'

describe('costs api', () => {
  it('asks for the costs without a query so the backend applies its defaults', async () => {
    const request = jest.fn().mockResolvedValue({ ok: true })

    await expect(fetchCosts(request, 7)).resolves.toEqual({ ok: true })
    expect(request).toHaveBeenCalledWith('/api/vehiculos/7/costos')
  })

  it('sends the km and the coverage the user chose', async () => {
    const request = jest.fn().mockResolvedValue({})

    await fetchCosts(request, 7, { km: 2500, coverage: 'todo_riesgo' })

    expect(request).toHaveBeenCalledWith('/api/vehiculos/7/costos?km=2500&cobertura=todo_riesgo')
  })

  it('sends km 0 as a real value', async () => {
    const request = jest.fn().mockResolvedValue({})

    await fetchCosts(request, 7, { km: 0 })

    expect(request).toHaveBeenCalledWith('/api/vehiculos/7/costos?km=0')
  })
})
