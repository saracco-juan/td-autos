import { describe, expect, it } from 'vitest'
import { appliedFilterChips, filterRecommendations, type RecommendationFilters } from './filters'

const first = { listing_id: 9, score: 92, price_ars: 20000000,
  vehicle: { anio: 2020, kilometraje: 60000, transmision: 'automatica' } }
const second = { listing_id: 2, score: 85, price_ars: 10000000,
  vehicle: { anio: 2018, kilometraje: 30000, transmision: 'manual' } }
const third = { listing_id: 1, score: 80, price_ars: 20000000,
  vehicle: { anio: 2022, kilometraje: 60000, transmision: 'automatica' } }
const results = [first, second, third]

describe('HU07 / RF06 agreed recommendation filters', () => {
  it.each<[RecommendationFilters, number[]]>([
    [{ maxPrice: 10000000 }, [2]],
    [{ minYear: 2020 }, [9, 1]],
    [{ maxKilometers: 30000 }, [2]],
    [{ transmission: 'automatica' }, [9, 1]],
    [{ transmission: 'manual' }, [2]],
  ])('TC-20 applies one criterion inclusively: %j', (filters, ids) => {
    expect(filterRecommendations(results, filters).map((r) => r.listing_id)).toEqual(ids)
  })

  it('TC-21 intersects criteria without reordering or changing matching scores', () => {
    const before = structuredClone(results)
    const filtered = filterRecommendations(results, {
      maxPrice: 20000000, minYear: 2020, maxKilometers: 60000, transmission: 'automatica',
    })
    expect(filtered).toEqual([first, third])
    expect(filtered[0]).toBe(first)
    expect(filtered.map((r) => r.score)).toEqual([92, 80])
    expect(results).toEqual(before)
  })

  it('TC-22 returns no matches for incompatible criteria', () => {
    expect(filterRecommendations(results, { minYear: 2020, transmission: 'manual' })).toEqual([])
  })

  it('uses the supplied ARS equivalent, not the published USD amount or a new quote', () => {
    const dollarListing = { ...first, published_price: 10000, published_currency: 'USD' }
    expect(filterRecommendations([dollarListing], { maxPrice: 15000000 })).toEqual([])
    expect(filterRecommendations([dollarListing], { maxPrice: 20000000 })).toEqual([dollarListing])
  })

  it('blank criteria retain all recommendations including unknown attributes', () => {
    const unknown = { price_ars: null, vehicle: {} }
    expect(filterRecommendations([unknown], {})).toEqual([unknown])
  })

  it.each<RecommendationFilters>([
    { maxPrice: 20000000 }, { minYear: 2020 }, { maxKilometers: 60000 }, { transmission: 'manual' },
  ])('excludes unknown attributes only when their criterion is active: %j', (filters) => {
    expect(filterRecommendations([{ price_ars: null, vehicle: {} }], filters)).toEqual([])
    expect(filterRecommendations([first], { minYear: 2020 })).toEqual([first])
  })

  it('accepts a zero-kilometer maximum as an active inclusive bound', () => {
    const unused = { ...first, vehicle: { ...first.vehicle, kilometraje: 0 } }
    expect(filterRecommendations([first, unused], { maxKilometers: 0 })).toEqual([unused])
  })
})

describe('HU07 applied filter chips', () => {
  it('labels each applied criterion in form order', () => {
    expect(appliedFilterChips({})).toEqual([])
    expect(appliedFilterChips({ transmission: 'manual', maxKilometers: 50000, minYear: 2019, maxPrice: 15000000 })).toEqual([
      { key: 'maxPrice', label: 'Hasta $ 15.000.000' },
      { key: 'minYear', label: 'Desde 2019' },
      { key: 'maxKilometers', label: 'Hasta 50.000 km' },
      { key: 'transmission', label: 'Manual' },
    ])
    expect(appliedFilterChips({ transmission: 'automatica' })[0].label).toBe('Automática')
  })
})
