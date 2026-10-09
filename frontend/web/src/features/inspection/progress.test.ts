import { describe, expect, it } from 'vitest'
import { VEHICLE_FALLBACK_TITLE, vehicleTitle } from './progress'

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
