import { describe, expect, it } from 'vitest'
import { buildVehicleFormData } from './api'
import { vehiculo } from './fixtures'
import { emptyValues, errorsFromServer, validateVehicleForm, valuesFromVehicle } from './vehicleFields'

const flags = [
  'control_estabilidad', 'frenos_abs', 'airbags_frontales', 'airbags_laterales',
  'airbags_cortina', 'isofix', 'frenado_autonomo', 'asistencia_carril', 'punto_ciego',
  'recordatorio_cinturon', 'asistencia_velocidad', 'monitoreo_conductor',
  'volante_regulable', 'climatizador_bizona', 'butacas_calefaccionadas',
  'android_auto_apple_carplay', 'sensores_estacionamiento', 'velocidad_crucero',
  'camara_retroceso', 'aire_acondicionado', 'turbo',
] as const
const facts = {
  moneda: 'USD' as const, plazas: 5, motor: '1.8', potencia: 140, potencia_unidad: 'CV' as const,
  consumo_urbano: 8.25, consumo_ruta: 6.5,
  ...Object.fromEntries(flags.map((key, index) => [key, index % 2 === 0])),
}

describe('HU05 matching facts in the vehicle form', () => {
  it('starts new power entries in CV without inventing a power value', () => {
    expect(emptyValues()).toMatchObject({ potencia: '', potencia_unidad: 'CV' })
  })

  it.each([
    [150, 'HP', '152'], [100, 'kW', '136'], [150, 'CV', '150'],
    [null, 'CV', ''], [undefined, 'CV', ''], [150, null, ''],
    // Simulate malformed API responses outside the declared unit union.
    [150, 'watts' as 'CV', ''], [150, 'toString' as 'CV', ''],
  ] as const)('loads %s %s as integer CV without relabelling unknown units', (potencia, potencia_unidad, expected) => {
    const saved = vehiculo({ potencia, potencia_unidad })
    const values = valuesFromVehicle(saved)
    expect(values).toMatchObject({ potencia: expected, potencia_unidad: 'CV' })
    expect(saved).toMatchObject({ potencia, potencia_unidad })
    const data = buildVehicleFormData({ values, newPhotos: [], removedPhotoIds: [] })
    expect(data.get('potencia')).toBe(expected)
    expect(data.get('potencia_unidad')).toBe('CV')
  })

  it('maps a unit rejection to the visible power input', () => {
    expect(errorsFromServer({ errors: { potencia_unidad: ['Revisá la potencia.'] } }))
      .toEqual({ potencia: ['Revisá la potencia.'] })
  })

  it('preserves every declared fact on edit and serializes yes/no as 1/0', () => {
    const values = valuesFromVehicle(vehiculo(facts))
    const data = buildVehicleFormData({ values, newPhotos: [], removedPhotoIds: [] })
    for (const [key, value] of Object.entries(facts)) {
      expect(data.get(key)).toBe(typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
    }
    expect(validateVehicleForm(values, 7)).toEqual({})
  })

  it.each(flags)('requires an explicit answer for %s without inventing unknown facts', (key) => {
    expect(emptyValues()[key]).toBe('')
    const values = valuesFromVehicle(vehiculo({ ...facts, [key]: null }))
    expect(values[key]).toBe('')
    expect(validateVehicleForm(values, 7)[key]).toBeDefined()
    expect(validateVehicleForm({ ...values, [key]: '0' }, 7)[key]).toBeUndefined()
    expect(validateVehicleForm({ ...values, [key]: 'false' }, 7)[key]).toBeDefined()
    expect(errorsFromServer({ errors: { [key]: ['Indicá sí o no.'] } })[key]).toEqual(['Indicá sí o no.'])
  })

  it.each(['nafta', 'diesel', 'gnc', 'hibrido', 'electrico'] as const)('handles consumption for %s', (combustible) => {
    const values = valuesFromVehicle(vehiculo({ ...facts, combustible, consumo_urbano: null, consumo_ruta: null }))
    const errors = validateVehicleForm(values, 7)
    const required = combustible === 'nafta' || combustible === 'diesel'
    for (const key of ['consumo_urbano', 'consumo_ruta'] as const) {
      expect(Boolean(errors[key])).toBe(required)
      expect(validateVehicleForm({ ...values, [key]: '0' }, 7)[key]).toBeDefined()
      expect(validateVehicleForm({ ...values, [key]: '6,25' }, 7)[key]).toBeUndefined()
      expect(validateVehicleForm({ ...values, [key]: '6.251' }, 7)[key]).toBeDefined()
      const data = buildVehicleFormData({ values: { ...values, [key]: '6,25' }, newPhotos: [], removedPhotoIds: [] })
      expect(data.get(key)).toBe('6.25')
    }
  })

  it.each([
    ['plazas', '0'], ['plazas', '2.5'], ['plazas', '32768'], ['motor', ''],
    ['motor', 'x'.repeat(101)], ['potencia', '0'], ['potencia', '1.5'],
    ['potencia_unidad', 'watts'], ['moneda', 'EUR'], ['consumo_urbano', '10000'],
  ])('rejects an invalid %s before sending', (key, value) => {
    const values = { ...valuesFromVehicle(vehiculo(facts)), [key]: value }
    expect(validateVehicleForm(values, 7)).toHaveProperty(key)
  })
})
