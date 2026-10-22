import { describe, expect, it } from 'vitest'
import { VEHICLE_FALLBACK_TITLE, parseVehicleId, vehicleTitle } from './vehicle'

describe('vehicleTitle', () => {
  it('joins brand, model, version and year with single spaces', () => {
    expect(vehicleTitle({ marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021 })).toBe(
      'Toyota Corolla XEI 2021',
    )
  })

  it('skips the parts that are null or blank', () => {
    expect(vehicleTitle({ marca: 'Ford', modelo: 'Focus', version: null, anio: 2017 })).toBe(
      'Ford Focus 2017',
    )
    expect(vehicleTitle({ marca: 'Fiat', modelo: '  ', version: '', anio: null })).toBe('Fiat')
  })

  it('trims each part so the separators stay single spaces', () => {
    expect(vehicleTitle({ marca: ' Renault ', modelo: 'Sandero', version: null, anio: null })).toBe(
      'Renault Sandero',
    )
  })

  it('falls back to a neutral title when every part is missing', () => {
    const empty = { marca: null, modelo: null, version: null, anio: null }

    expect(vehicleTitle(empty)).toBe('Vehículo')
    expect(VEHICLE_FALLBACK_TITLE).toBe('Vehículo')
  })
})

describe('parseVehicleId', () => {
  it('accepts a positive integer', () => {
    expect(parseVehicleId('7')).toBe(7)
    expect(parseVehicleId('120')).toBe(120)
  })

  it('rejects anything that cannot be a vehicle id', () => {
    for (const raw of [undefined, '', '0', '07', '-3', '1.5', 'abc', '7a']) {
      expect(parseVehicleId(raw)).toBeNull()
    }
  })
})
