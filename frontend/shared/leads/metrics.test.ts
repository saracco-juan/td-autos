import { expect, it } from 'vitest'
import { calculateLeadMetrics } from './metrics'

it('calculates vehicle coverage, exact brand totals and top-three concentration without mutating the ranking', () => {
  const vehicles = [
    { id: 1, label: 'A', brand: 'Toyota', leads: 2 },
    { id: 2, label: 'B', brand: 'Ford', leads: 5 },
    { id: 3, label: 'C', brand: 'Toyota', leads: 3 },
    { id: 4, label: 'D', brand: 'Land Rover', leads: 0 },
    { id: 5, label: 'E', brand: 'Fiat', leads: 1 },
  ]
  const before = JSON.stringify(vehicles)
  expect(calculateLeadMetrics({ total: 11, vehicles })).toEqual({
    contacted: 4, inventory: 5, coverage: 80, topCount: 3, concentration: 91,
    brands: [{ label: 'Ford', leads: 5 }, { label: 'Toyota', leads: 5 }, { label: 'Fiat', leads: 1 }],
  })
  expect(JSON.stringify(vehicles)).toBe(before)
})

it('returns safe zero percentages for empty inventory and for vehicles without contacts', () => {
  for (const vehicles of [[], [{ id: 1, label: 'A', brand: 'Ford', leads: 0 }]]) {
    expect(calculateLeadMetrics({ total: 0, vehicles })).toMatchObject({
      contacted: 0, inventory: vehicles.length, coverage: 0, topCount: 0, concentration: 0, brands: [],
    })
  }
})

it('groups smaller brands into Otras without losing contacts, and supports responses without brand metadata', () => {
  const vehicles = Array.from({ length: 7 }, (_, id) => ({ id, label: `Auto ${id}`, brand: `Marca ${id}`, leads: 7 - id }))
  const { brands } = calculateLeadMetrics({ total: 28, vehicles })
  expect(brands).toHaveLength(6)
  expect(brands.at(-1)).toEqual({ label: 'Otras', leads: 3 })
  expect(brands.reduce((sum, brand) => sum + brand.leads, 0)).toBe(28)
  expect(calculateLeadMetrics({ total: 1, vehicles: [{ id: 1, label: 'A', leads: 1 }] }).brands)
    .toEqual([{ label: 'Sin marca', leads: 1 }])
})
