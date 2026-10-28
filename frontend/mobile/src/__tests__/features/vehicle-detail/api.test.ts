import { fetchVehicleDetail } from '../../../features/vehicle-detail/api'

describe('vehicle detail api', () => {
  it('fetches the public detail of the vehicle', async () => {
    const response = { vehicle: { id: 7 }, dealer: { id: 1, nombre: 'Autos Sur', provincia: null } }
    const request = jest.fn().mockResolvedValue(response)

    await expect(fetchVehicleDetail(request, 7)).resolves.toEqual(response)
    expect(request).toHaveBeenCalledWith('/api/vehiculos/7')
  })
})
