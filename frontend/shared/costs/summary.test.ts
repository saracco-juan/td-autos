import { describe, expect, it } from 'vitest'
import { monthlyLines, purchaseLines } from './summary'
import type { OwnershipCosts } from './types'

const base = {
  vehicle: { id: 7, make: 'Toyota', model: 'Corolla', version: 'XEI', year: 2022, fuel: 'nafta', province: 'Córdoba', published_price: 20000000, published_currency: 'ARS' },
  inputs: { km_per_month: 1500, km_source: 'diagnostico', coverage: 'terceros_completo' },
  purchase: { price: 20000000, transfer: 700000, total: 20700000, budget: { max: 25000000, fits: true, difference: 4300000 } },
  monthly: { fuel: 120000, insurance: 96000, patente: 20000, total: 236000, not_estimated: [] },
  yearly: { service: 972000, total: 3804000 },
  breakdown: {
    fuel: { km_per_month: 1500, consumption_l_100km: 8, fuel_type: 'nafta', price_fuel_type: 'nafta', unit: 'litro', unit_price: 1000 },
    insurance: { coverage: 'terceros_completo', base: 20000000, floor: 46000, value_rate: 0.0037, zone_factor: 0.8, province: 'Córdoba', province_known: true, tr_ratio: null, terceros_completo: 96000 },
    patente: { base_source: 'listing', base: 20000000, province: 'Córdoba', province_known: true, method: 'bracket_rate', rate: 0.025, bracket_fixed: null, bracket_from: null, annual: 500000, age: 4, age_band: null, body_kind: null, subtotal: 500000, surcharge: 0, cap_rate: null, cap_applied: false, minimum: null, minimum_applied: false, exempt: false, exempt_from_age: null },
    service: { brand: 'Toyota', brand_known: true, model_matched: true, body_type: 'sedan', body_label: 'Sedán', km_per_year: 18000, interval_km: 10000, interval_months: 12, services_per_year: 2, price_per_service: 486000, fuel_factor: 1, source_label: 'service oficial Toyota Corolla XEI' },
    transfer: { base: 20000000, dnrpa_rate: 0.01, stamp_rate: 0.02, province: 'Córdoba', province_known: true, fixed_costs: 100000 },
    rounding: 1000,
  },
  rates_updated_at: '2026-10-23',
  exchange_rate: null,
}

function costs(changes: (draft: any) => void = () => {}): OwnershipCosts {
  const draft = structuredClone(base)
  changes(draft)
  return draft as unknown as OwnershipCosts
}

describe('monthlyLines', () => {
  it('lists the monthly concepts, the totals and the yearly service in order', () => {
    const { lines, note } = monthlyLines(costs())
    expect(lines.map((line) => [line.label, line.value, line.strong ?? false])).toEqual([
      ['Combustible', '$ 120.000 por mes', false],
      ['Seguro', '$ 96.000 por mes', false],
      ['Patente', '$ 20.000 por mes', false],
      ['Total por mes', '$ 236.000', true],
      ['Service (por año)', '$ 972.000', false],
      ['Total por año', '$ 3.804.000', true],
    ])
    expect(lines[0].info?.name).toBe('Combustible')
    expect(lines[0].info?.text).not.toBe('')
    expect(lines[3].info).toBeUndefined()
    expect(note).toBeNull()
  })

  it('says the fuel cannot be estimated and leaves it out of the total', () => {
    const { lines, note } = monthlyLines(costs((d) => { d.monthly.fuel = null; d.monthly.not_estimated = ['fuel'] }))
    expect(lines[0].value).toBe('No podemos estimarlo')
    expect(note).toBe('El total no incluye el combustible.')
  })

  it('announces charging for electric cars', () => {
    const { lines, note } = monthlyLines(costs((d) => { d.vehicle.fuel = 'electrico'; d.monthly.fuel = null; d.monthly.not_estimated = ['fuel'] }))
    expect(lines[0].value).toBe('Próximamente')
    expect(note).toBe('El total no incluye la carga del auto.')
  })
})

describe('purchaseLines', () => {
  it('lists price, transfer and total with the given price label', () => {
    const { lines, usdNote } = purchaseLines(costs(), 'Precio')
    expect(lines.map((line) => [line.label, line.value, line.strong ?? false])).toEqual([
      ['Precio', '$ 20.000.000', false],
      ['Transferencia', '$ 700.000', false],
      ['Total', '$ 20.700.000', true],
    ])
    expect(lines[0].info).toBeUndefined()
    expect(lines[1].info?.name).toBe('Transferencia')
    expect(usdNote).toBeNull()
    expect(purchaseLines(costs(), 'Precio publicado').lines[0].label).toBe('Precio publicado')
  })

  it('explains the conversion and notes the quote for a price published in dollars', () => {
    const { lines, usdNote } = purchaseLines(
      costs((d) => { d.vehicle.published_currency = 'USD'; d.vehicle.published_price = 20000; d.exchange_rate = { sell: 1030, updated_at: '2026-10-20T12:00:00Z' } }),
      'Precio',
    )
    expect(lines[0].info?.name).toBe('Precio publicado')
    expect(usdNote).toBe('Publicado en US$ 20.000, al dólar oficial venta de $ 1.030 (20/10/2026).')
  })

  it('reports whether the purchase fits the budget', () => {
    expect(purchaseLines(costs(), 'Precio').budget).toEqual({ fits: true, message: 'Entra en tu presupuesto (te sobran $ 4.300.000).' })
    const over = purchaseLines(costs((d) => { d.purchase.budget = { max: 1, fits: false, difference: -500000 } }), 'Precio').budget
    expect(over).toEqual({ fits: false, message: 'Supera tu presupuesto por $ 500.000.' })
    expect(purchaseLines(costs((d) => { d.purchase.budget = null }), 'Precio').budget).toBeNull()
  })
})
