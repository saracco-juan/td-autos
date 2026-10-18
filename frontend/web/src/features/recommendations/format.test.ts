import { describe, expect, it } from 'vitest'
import { listing } from './fixtures'
import { listingMeta, listingTitle } from './format'

describe('listingTitle', () => {
  it('joins brand, model, version and year', () => {
    expect(listingTitle(listing())).toBe('Toyota Corolla XEI 2021')
  })

  it('skips the version or the year when they are missing', () => {
    expect(listingTitle(listing({ version: null, anio: null }))).toBe('Toyota Corolla')
  })

  it('falls back to the original title when the brand or the model is missing', () => {
    expect(listingTitle(listing({ marca: null }))).toBe('Toyota Corolla XEI 2.0 CVT 2021')
    expect(listingTitle(listing({ modelo: '' }))).toBe('Toyota Corolla XEI 2.0 CVT 2021')
  })
})

describe('listingMeta', () => {
  it('formats price, kilometres and location with Argentine separators', () => {
    expect(listingMeta(listing())).toBe('$ 28.900.000 · 62.000 km · CABA')
  })

  it('shows dollars as US$', () => {
    expect(listingMeta(listing({ precio: 15000, moneda: 'USD' }))).toBe('US$ 15.000 · 62.000 km · CABA')
  })

  it('omits the parts that are missing, never printing null or undefined', () => {
    expect(listingMeta(listing({ precio: null, kilometraje: null }))).toBe('CABA')
    expect(listingMeta(listing({ ubicacion: null }))).toBe('$ 28.900.000 · 62.000 km')
    expect(listingMeta(listing({ precio: null, kilometraje: null, ubicacion: null }))).toBe('')
  })

  it('keeps a zero kilometres reading', () => {
    expect(listingMeta(listing({ kilometraje: 0, precio: null, ubicacion: null }))).toBe('0 km')
  })
})
