import { describe, expect, it } from 'vitest'
import { searchInventory } from '../../../features/inventory/model/searchInventory'
import { VEHICULOS, vehiculo } from '../../fixtures/inventory/fixtures'

describe('searchInventory', () => {
  it('matches make, model, version, year and plate without case or accent differences', () => {
    const vehicle = vehiculo({ marca: 'Peugeot', modelo: '208', version: 'Allure', anio: 2023, patente: 'ABÉ123' })

    for (const query of ['PEUGEOT', '208', 'allure', '2023', 'abe123']) {
      expect(searchInventory([vehicle], query)).toEqual([vehicle])
    }
  })

  it('matches any searched field and returns the original list for a blank query', () => {
    expect(searchInventory(VEHICULOS, '  cronos  ')).toEqual([VEHICULOS[1]])
    expect(searchInventory(VEHICULOS, '   ')).toBe(VEHICULOS)
  })
})
