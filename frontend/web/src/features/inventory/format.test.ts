import { describe, expect, it } from 'vitest'
import { vehiculo } from './fixtures'
import { formatKilometers, formatPrice, vehicleMeta, vehicleTitle } from './format'

describe('vehicleTitle', () => {
  it('joins brand, model, version and year', () => {
    expect(vehicleTitle(vehiculo())).toBe('Toyota Corolla XEI 2021')
  })

  it('leaves the version out when there is none', () => {
    expect(vehicleTitle(vehiculo({ version: null }))).toBe('Toyota Corolla 2021')
  })
})

describe('formatKilometers', () => {
  it.each([
    [0, '0 km'],
    [950, '950 km'],
    [60000, '60.000 km'],
    [1234567, '1.234.567 km'],
  ])('writes %s as %s', (value, text) => {
    expect(formatKilometers(value)).toBe(text)
  })
})

describe('formatPrice', () => {
  it('distinguishes dollars without converting the published amount', () => {
    expect(formatPrice(18500, 'USD')).toBe('US$ 18.500')
    expect(vehicleMeta(vehiculo({ precio: 18500, moneda: 'USD' }))).toContain('US$ 18.500')
  })

  it.each([
    [18500000, '$ 18.500.000'],
    [950000, '$ 950.000'],
    [500, '$ 500'],
  ])('writes %s as Argentine pesos: %s', (value, text) => {
    expect(formatPrice(value)).toBe(text)
  })
})

describe('vehicleMeta', () => {
  it('shows plate, image count, kilometres, price and location', () => {
    expect(vehicleMeta(vehiculo())).toBe('AB123CD · 7 imágenes · 60.000 km · $ 18.500.000 · Córdoba')
  })

  it('writes the image count in the singular for one image', () => {
    const one = vehiculo({ fotos: [{ id: 1, url: 'http://localhost/a.jpg', orden: 1 }] })
    expect(vehicleMeta(one)).toContain('AB123CD · 1 imagen · ')
  })
})
