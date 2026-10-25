import { describe, expect, it } from 'vitest'
import { MATCHING_FACTS, VEHICULOS, vehiculo } from './fixtures'
import { matchingValues } from './matchingFields'
import {
  emptyValues,
  errorsFromServer,
  firstInvalidField,
  normalizePlate,
  validateVehicleForm,
  valuesFromVehicle,
  type VehicleValues,
} from './vehicleFields'

const valid: VehicleValues = {
  ...matchingValues(MATCHING_FACTS),
  patente: 'AB123CD',
  marca: 'Toyota',
  modelo: 'Corolla',
  version: '',
  acara_version_id: '',
  anio: '2021',
  kilometraje: '60000',
  precio: '18500000',
  transmision: 'automatica',
  combustible: 'nafta',
  carroceria_id: '2',
  ubicacion: 'Córdoba',
  descripcion: '',
}

const check = (overrides: Partial<VehicleValues>, photos = 7) => validateVehicleForm({ ...valid, ...overrides }, photos, 2026)

describe('normalizePlate', () => {
  it('uppercases and drops spaces, dashes and dots like the server', () => {
    expect(normalizePlate(' ab-123 c.d ')).toBe('AB123CD')
  })
})

describe('emptyValues and valuesFromVehicle', () => {
  it('starts with empty facts and the fixed CV power unit', () => {
    expect(emptyValues()).toEqual({
      ...matchingValues(),
      potencia_unidad: 'CV',
      patente: '',
      marca: '',
      modelo: '',
      version: '',
      acara_version_id: '',
      anio: '',
      kilometraje: '',
      precio: '',
      transmision: '',
      combustible: '',
      carroceria_id: '',
      ubicacion: '',
      descripcion: '',
    })
  })

  it('turns a vehicle into form strings, null optionals becoming empty', () => {
    expect(valuesFromVehicle(VEHICULOS[0])).toEqual({ ...valid, version: 'XEI' })
    expect(valuesFromVehicle(vehiculo({ version: null })).version).toBe('')
    expect(valuesFromVehicle(vehiculo({ descripcion: 'Único dueño' })).descripcion).toBe('Único dueño')
  })

  it('RF22: leaves a missing historical body type empty and requires it before saving', () => {
    const values = valuesFromVehicle(vehiculo({ carroceria: null }))
    expect(values.carroceria_id).toBe('')
    expect(validateVehicleForm(values, 7, 2026).carroceria_id).toEqual(['Elegí la carrocería.'])
  })
})

describe('validateVehicleForm', () => {
  it('accepts a complete form', () => {
    expect(check({})).toEqual({})
    expect(check({ version: 'XEI', descripcion: 'Único dueño' }, 20)).toEqual({})
  })

  it('requires every mandatory field with the server wording', () => {
    const errors = validateVehicleForm(emptyValues(), 7, 2026)

    expect(errors).toMatchObject({
      patente: ['Indicá la patente.'],
      marca: ['Indicá la marca.'],
      modelo: ['Indicá el modelo.'],
      anio: ['Indicá el año.'],
      kilometraje: ['Indicá el kilometraje.'],
      precio: ['Indicá el precio.'],
      transmision: ['Elegí la transmisión.'],
      combustible: ['Elegí el combustible.'],
      carroceria_id: ['Elegí la carrocería.'],
      ubicacion: ['Indicá la ubicación.'],
    })
  })

  it('treats a whitespace-only text as empty', () => {
    expect(check({ marca: '   ' }).marca).toEqual(['Indicá la marca.'])
  })

  it.each(['AAA123', 'AA123AA', 'aa-123 aa', 'abc 123'])('accepts the plate %s', (patente) => {
    expect(check({ patente }).patente).toBeUndefined()
  })

  it.each(['AB12CD', 'ABCD123', '123ABC', 'AB1234C'])('rejects the plate %s after normalizing', (patente) => {
    expect(check({ patente }).patente).toEqual(['Ingresá una patente válida, por ejemplo AB123CD o ABC123.'])
  })

  it('limits the length of the text fields', () => {
    expect(check({ marca: 'a'.repeat(101) }).marca).toEqual(['Revisá la marca: no puede superar los 100 caracteres.'])
    expect(check({ modelo: 'a'.repeat(101) }).modelo).toEqual(['Revisá el modelo: no puede superar los 100 caracteres.'])
    expect(check({ version: 'a'.repeat(101) }).version).toEqual(['Revisá la versión: no puede superar los 100 caracteres.'])
    expect(check({ ubicacion: 'a'.repeat(151) }).ubicacion).toEqual(['Revisá la ubicación: no puede superar los 150 caracteres.'])
    expect(check({ descripcion: 'a'.repeat(2001) }).descripcion).toEqual([
      'Revisá la descripción: no puede superar los 2000 caracteres.',
    ])
    expect(check({ marca: 'a'.repeat(100), descripcion: 'a'.repeat(2000) })).toEqual({})
  })

  it('keeps the year between 1950 and next year', () => {
    expect(check({ anio: '1949' }).anio).toEqual(['Revisá el año: está fuera del rango permitido.'])
    expect(check({ anio: '2028' }).anio).toEqual(['Revisá el año: está fuera del rango permitido.'])
    expect(check({ anio: '1950' }).anio).toBeUndefined()
    expect(check({ anio: '2027' }).anio).toBeUndefined()
    expect(check({ anio: '20.5' }).anio).toEqual(['Revisá el año: tiene que ser un número entero.'])
    expect(check({ anio: 'abc' }).anio).toEqual(['Revisá el año: tiene que ser un número entero.'])
  })

  it('keeps the kilometers a whole number from 0 to 2.000.000', () => {
    expect(check({ kilometraje: '0' }).kilometraje).toBeUndefined()
    expect(check({ kilometraje: '2000000' }).kilometraje).toBeUndefined()
    expect(check({ kilometraje: '2000001' }).kilometraje).toEqual(['Revisá el kilometraje: está fuera del rango permitido.'])
    expect(check({ kilometraje: '-1' }).kilometraje).toEqual(['Revisá el kilometraje: tiene que ser un número entero.'])
    expect(check({ kilometraje: '1,5' }).kilometraje).toEqual(['Revisá el kilometraje: tiene que ser un número entero.'])
  })

  it('keeps the price a number from 1 to 9.999.999.999,99, with up to two decimals', () => {
    expect(check({ precio: '1' }).precio).toBeUndefined()
    expect(check({ precio: '18500000.50' }).precio).toBeUndefined()
    expect(check({ precio: '18500000,5' }).precio).toBeUndefined()
    expect(check({ precio: '0' }).precio).toEqual(['Revisá el precio: está fuera del rango permitido.'])
    expect(check({ precio: '10000000000' }).precio).toEqual(['Revisá el precio: está fuera del rango permitido.'])
    expect(check({ precio: '$ 1.000' }).precio).toEqual(['Revisá el precio: tiene que ser un número.'])
    expect(check({ precio: '1.234.567' }).precio).toEqual(['Revisá el precio: tiene que ser un número.'])
  })

  it('requires seven to twenty photos in total', () => {
    expect(check({}, 6).fotos).toEqual(['Cargá al menos siete fotos.'])
    expect(check({}, 0).fotos).toEqual(['Cargá al menos siete fotos.'])
    expect(check({}, 21).fotos).toEqual(['Podés cargar hasta 20 fotos.'])
    expect(check({}, 7).fotos).toBeUndefined()
    expect(check({}, 20).fotos).toBeUndefined()
  })
})

describe('errorsFromServer', () => {
  it('maps field errors and the photo count errors', () => {
    const body = {
      message: 'The given data was invalid.',
      errors: {
        patente: ['Esa patente ya está cargada en la plataforma.'],
        carroceria_id: ['Elegí la carrocería.'],
        fotos: ['Cargá al menos siete fotos.'],
      },
    }

    expect(errorsFromServer(body)).toEqual({
      patente: ['Esa patente ya está cargada en la plataforma.'],
      carroceria_id: ['Elegí la carrocería.'],
      fotos: ['Cargá al menos siete fotos.'],
    })
  })

  it('folds fotos.N and fotos_eliminar.N into the photo errors without repeating a message', () => {
    const body = {
      errors: {
        'fotos.0': ['Cada foto tiene que ser una imagen JPG, PNG o WebP.'],
        'fotos.3': ['Cada foto tiene que ser una imagen JPG, PNG o WebP.'],
        'fotos_eliminar.1': ['Una de las fotos a eliminar no pertenece a este vehículo.'],
      },
    }

    expect(errorsFromServer(body)).toEqual({
      fotos: [
        'Cada foto tiene que ser una imagen JPG, PNG o WebP.',
        'Una de las fotos a eliminar no pertenece a este vehículo.',
      ],
    })
  })

  it('ignores unknown keys and malformed bodies', () => {
    expect(errorsFromServer({ errors: { otro: ['x'] } })).toEqual({})
    expect(errorsFromServer(undefined)).toEqual({})
    expect(errorsFromServer('Server Error')).toEqual({})
    expect(errorsFromServer({ errors: { marca: [] } })).toEqual({})
  })
})

describe('firstInvalidField', () => {
  it('follows the order of the screen, photos last', () => {
    expect(firstInvalidField({ fotos: ['x'], ubicacion: ['x'], modelo: ['x'] })).toBe('modelo')
    expect(firstInvalidField({ fotos: ['x'] })).toBe('fotos')
    expect(firstInvalidField({})).toBeUndefined()
  })
})
