import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '../../lib/http'
import { buildVehicleFormData, createVehicle, deleteVehicle, fetchBodyTypes, fetchVehicle, fetchVehicles, updateVehicle } from './api'
import { VEHICULOS, vehiculo } from './fixtures'
import { emptyValues, type VehicleValues } from './vehicleFields'

describe('inventory api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('fetchVehicles GETs the dealer vehicles and returns the list', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ vehiculos: VEHICULOS })

    await expect(fetchVehicles()).resolves.toEqual(VEHICULOS)
    expect(apiFetch).toHaveBeenCalledWith('/api/concesionaria/vehiculos')
  })

  it('deleteVehicle sends a DELETE for that vehicle', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined)

    await expect(deleteVehicle(7)).resolves.toBeUndefined()
    expect(apiFetch).toHaveBeenCalledWith('/api/concesionaria/vehiculos/7', { method: 'DELETE' })
  })

  it('lets the errors of apiFetch propagate', async () => {
    const failure = new Error('HTTP 500')
    vi.mocked(apiFetch).mockRejectedValue(failure)

    await expect(fetchVehicles()).rejects.toBe(failure)
    await expect(deleteVehicle(1)).rejects.toBe(failure)
  })

  describe('vehicle form requests', () => {
    const values: VehicleValues = {
      ...emptyValues(),
      patente: ' ab-123 cd ',
      marca: ' Toyota ',
      modelo: 'Corolla',
      version: '',
      anio: '2021',
      kilometraje: '60000',
      precio: '18500000,50',
      transmision: 'automatica',
      combustible: 'nafta',
      carroceria_id: '2',
      ubicacion: 'Córdoba',
      descripcion: '',
    }
    const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

    it('buildVehicleFormData sends every field as a string, empty optionals included so an edit can clear them', () => {
      const data = buildVehicleFormData({ values, newPhotos: [], removedPhotoIds: [] })

      expect(Object.fromEntries(data.entries())).toEqual({
        patente: 'AB123CD',
        marca: 'Toyota',
        modelo: 'Corolla',
        version: '',
        anio: '2021',
        kilometraje: '60000',
        precio: '18500000.50',
        transmision: 'automatica',
        combustible: 'nafta',
        carroceria_id: '2',
        ubicacion: 'Córdoba',
        descripcion: '',
      })
    })

    it('buildVehicleFormData appends the new files as fotos[] in order and the removed ids as fotos_eliminar[]', () => {
      const first = photo('a.jpg')
      const second = photo('b.jpg')
      const data = buildVehicleFormData({ values, newPhotos: [first, second], removedPhotoIds: [4, 9] })

      expect(data.getAll('fotos[]')).toEqual([first, second])
      expect(data.getAll('fotos_eliminar[]')).toEqual(['4', '9'])
    })

    it('createVehicle POSTs the multipart body and returns the vehicle', async () => {
      const created = vehiculo({ id: 9 })
      vi.mocked(apiFetch).mockResolvedValue({ vehiculo: created })
      const submission = { values, newPhotos: [photo('a.jpg')], removedPhotoIds: [] }

      await expect(createVehicle(submission)).resolves.toEqual(created)

      const [path, options] = vi.mocked(apiFetch).mock.calls[0]
      expect(path).toBe('/api/concesionaria/vehiculos')
      expect(options?.method).toBe('POST')
      expect(options?.body).toBeInstanceOf(FormData)
      expect((options?.body as FormData).getAll('fotos[]')).toHaveLength(1)
    })

    it('updateVehicle POSTs the multipart body to that vehicle and returns it', async () => {
      const updated = vehiculo({ id: 7 })
      vi.mocked(apiFetch).mockResolvedValue({ vehiculo: updated })

      await expect(updateVehicle(7, { values, newPhotos: [], removedPhotoIds: [3] })).resolves.toEqual(updated)

      const [path, options] = vi.mocked(apiFetch).mock.calls[0]
      expect(path).toBe('/api/concesionaria/vehiculos/7')
      expect(options?.method).toBe('POST')
      expect((options?.body as FormData).getAll('fotos_eliminar[]')).toEqual(['3'])
    })

    it('fetchVehicle GETs that vehicle and unwraps it', async () => {
      const found = vehiculo({ id: 7 })
      vi.mocked(apiFetch).mockResolvedValue({ vehiculo: found })

      await expect(fetchVehicle(7)).resolves.toEqual(found)
      expect(apiFetch).toHaveBeenCalledWith('/api/concesionaria/vehiculos/7')
    })

    it('fetchBodyTypes reuses the catalog the diagnosis reads', async () => {
      const bodyTypes = [{ id: 1, nombre: 'Sedán' }]
      vi.mocked(apiFetch).mockResolvedValue({ diagnostico: null, carrocerias: bodyTypes })

      await expect(fetchBodyTypes()).resolves.toEqual(bodyTypes)
      expect(apiFetch).toHaveBeenCalledWith('/api/diagnostico')
    })
  })
})
