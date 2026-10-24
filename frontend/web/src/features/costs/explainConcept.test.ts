import { describe, expect, it } from 'vitest'
import { explainConcept } from './explainConcept'
import type { CostBreakdown } from './types'

const insurance = (changes: Partial<CostBreakdown['insurance']> = {}): CostBreakdown['insurance'] => ({
  coverage: 'terceros_completo', base: 23000000, body_type: 'hatchback', body_label: 'Hatchback', base_monthly: 103000,
  value_rate: 0.023, by_value: false, zone_factor: 0.8, province: 'Córdoba', province_known: true, tr_ratio: null,
  terceros_completo: 83000,
  ...changes,
})

const breakdown = (changes: Partial<CostBreakdown> = {}): CostBreakdown => ({
  fuel: { km_per_month: 1500, consumption_l_100km: 8, fuel_type: 'nafta', price_fuel_type: 'nafta', unit: 'litro', unit_price: 2125 },
  insurance: insurance(),
  patente: { base: 23000000, province: 'Córdoba', province_known: true, annual_rate: 0.032 },
  maintenance: { fuel_type: 'nafta', annual_base: 1000000, age_years: 5, age_factor: 1, km: 70000, km_factor: 1.2,
    turbo_factor: null, automatic_factor: null },
  transfer: { base: 23000000, dnrpa_rate: 0.015, stamp_rate: 0.03, province: 'Córdoba', province_known: true, fixed_costs: 80000 },
  rounding: 1000,
  ...changes,
})

describe('explainConcept', () => {
  it('explains the fuel with the km, the consumption and the price', () => {
    expect(explainConcept('fuel', breakdown(), 255000)).toBe(
      '1.500 km por mes × 8 L cada 100 km (consumo del auto) × $ 2.125 el litro de nafta = $ 255.000.',
    )
  })

  it('reads diesel with an accent and a decimal consumption with a comma', () => {
    const fuel = { km_per_month: 1500, consumption_l_100km: 6.5, fuel_type: 'diesel' as const, price_fuel_type: 'diesel' as const, unit: 'litro' as const, unit_price: 2450 }
    expect(explainConcept('fuel', breakdown({ fuel }), 240000)).toContain('6,5 L cada 100 km (consumo del auto) × $ 2.450 el litro de diésel = $ 240.000.')
  })

  it('uses cubic meters for GNC', () => {
    const fuel = { km_per_month: 1500, consumption_l_100km: 8, fuel_type: 'gnc' as const, price_fuel_type: 'gnc' as const, unit: 'm3' as const, unit_price: 1100 }
    expect(explainConcept('fuel', breakdown({ fuel }), 132000)).toContain('8 m³ cada 100 km (consumo del auto) × $ 1.100 el m³ de GNC = $ 132.000.')
  })

  it('prices a hybrid with the nafta price', () => {
    const fuel = { km_per_month: 1500, consumption_l_100km: 5, fuel_type: 'hibrido' as const, price_fuel_type: 'nafta' as const, unit: 'litro' as const, unit_price: 2125 }
    expect(explainConcept('fuel', breakdown({ fuel }), 160000)).toContain('5 L cada 100 km (consumo del auto) × $ 2.125 el litro de nafta = $ 160.000.')
  })

  it('tells an electric car that charging costs are coming', () => {
    expect(explainConcept('charging', breakdown({ fuel: null }), null)).toBe('Pronto vas a poder ver cuánto te cuesta cargarlo.')
  })

  it('says there is no fuel estimate when the car has no consumption data', () => {
    const text = explainConcept('fuel', breakdown({ fuel: null }), null)
    expect(text).toBe('No tenemos datos de consumo de este auto, así que no podemos estimar el combustible.')
  })

  it('explains terceros completo with the body base and the zone', () => {
    expect(explainConcept('insurance', breakdown(), 83000)).toBe(
      'Terceros completo para un hatchback: $ 103.000 por mes de referencia, × 0,8 por la zona (Córdoba) = $ 83.000 por mes. Sale de cotizaciones publicadas en octubre de 2026.',
    )
  })

  it('names each body type with its article', () => {
    const tip = (body_type: CostBreakdown['insurance']['body_type']) =>
      explainConcept('insurance', breakdown({ insurance: insurance({ body_type }) }), 83000)
    expect(tip('sedan')).toContain('para un sedán')
    expect(tip('rural')).toContain('para una rural')
    expect(tip('suv')).toContain('para un SUV')
    expect(tip('pickup')).toContain('para una pickup')
    expect(tip('furgon')).toContain('para un furgón')
  })

  it('explains terceros completo by the value of the car when the value decides', () => {
    const value = insurance({ body_type: 'pickup', body_label: 'Pickup', base: 80000000, by_value: true, zone_factor: 1,
      province: 'Buenos Aires', terceros_completo: 154000 })
    expect(explainConcept('insurance', breakdown({ insurance: value }), 154000)).toBe(
      'Terceros completo: 2,3% anual del valor del auto, dividido 12 meses, × 1 por la zona (Buenos Aires) = $ 154.000 por mes.',
    )
  })

  it('omits the body type and the province when they were not recognized', () => {
    const unknown = insurance({ body_type: null, body_label: null, province_known: false, province: 'Atlántida' })
    expect(explainConcept('insurance', breakdown({ insurance: unknown }), 83000)).toBe(
      'Terceros completo: $ 103.000 por mes de referencia, × 0,8 por la zona = $ 83.000 por mes. Sale de cotizaciones publicadas en octubre de 2026.',
    )
  })

  it('explains todo riesgo as terceros completo times the ratio of the body type', () => {
    const tr = insurance({ coverage: 'todo_riesgo', body_type: 'pickup', body_label: 'Pickup', tr_ratio: 2.35, value_rate: 0.06,
      terceros_completo: 154000 })
    expect(explainConcept('insurance', breakdown({ insurance: tr }), 362000)).toBe(
      'Todo riesgo: terceros completo ($ 154.000) × 2,35 para una pickup = $ 362.000 por mes.',
    )
  })

  it('explains todo riesgo by the value of the car when the value decides', () => {
    const tr = insurance({ coverage: 'todo_riesgo', body_type: 'pickup', body_label: 'Pickup', tr_ratio: 2.35, value_rate: 0.06,
      by_value: true, base: 80000000, terceros_completo: 154000 })
    expect(explainConcept('insurance', breakdown({ insurance: tr }), 400000)).toBe(
      'Todo riesgo: 6% anual del valor del auto, dividido 12 meses = $ 400.000 por mes.',
    )
  })

  it('never reveals a ceiling or a rounding in the insurance text', () => {
    const texts = [
      explainConcept('insurance', breakdown(), 83000),
      explainConcept('insurance', breakdown({ insurance: insurance({ by_value: true }) }), 83000),
      explainConcept('insurance', breakdown({ insurance: insurance({ coverage: 'todo_riesgo', tr_ratio: 1.8 }) }), 150000),
      explainConcept('insurance', breakdown({ insurance: insurance({ coverage: 'todo_riesgo', tr_ratio: 1.8, by_value: true }) }), 150000),
    ]
    for (const text of texts) expect(text).not.toMatch(/máxim|más alt|hasta|redonde|techo/i)
  })

  it('explains the patente with the provincial rate in Argentine format', () => {
    expect(explainConcept('patente', breakdown(), 62000)).toBe(
      'Alícuota anual de 3,2% en Córdoba, sobre el valor del auto, dividido 12 meses = $ 62.000 por mes.',
    )
  })

  it('omits the province name when it was not recognized', () => {
    const patente = { base: 23000000, province: 'Atlántida', province_known: false, annual_rate: 0.045 }
    expect(explainConcept('patente', breakdown({ patente }), 87000)).toBe(
      'Alícuota anual de 4,5% sobre el valor del auto, dividido 12 meses = $ 87.000 por mes.',
    )
  })

  it('explains the maintenance with the age and km factors', () => {
    expect(explainConcept('maintenance', breakdown(), 100000)).toBe(
      'Service anual de referencia para un auto a nafta ($ 1.000.000), ajustado por antigüedad (5 años, ×1) y kilometraje (70.000 km, ×1,2), dividido 12 meses = $ 100.000 por mes.',
    )
  })

  it('adds the turbo and automatic factors only when they apply', () => {
    const maintenance = { ...breakdown().maintenance, age_years: 1, turbo_factor: 1.15, automatic_factor: 1.2 }
    const text = explainConcept('maintenance', breakdown({ maintenance }), 140000)
    expect(text).toContain('antigüedad (1 año, ×1)')
    expect(text).toContain('(70.000 km, ×1,2), turbo (×1,15), caja automática (×1,2), dividido 12 meses')
    expect(explainConcept('maintenance', breakdown(), 100000)).not.toMatch(/turbo|automática/)
  })

  it('names the fuel type of a diesel, GNC, hybrid and electric car', () => {
    const named = (fuel_type: CostBreakdown['maintenance']['fuel_type']) =>
      explainConcept('maintenance', breakdown({ maintenance: { ...breakdown().maintenance, fuel_type } }), 1000)
    expect(named('diesel')).toContain('para un auto a diésel')
    expect(named('gnc')).toContain('para un auto a GNC')
    expect(named('hibrido')).toContain('para un auto híbrido')
    expect(named('electrico')).toContain('para un auto eléctrico')
  })

  it('explains the transfer with the registry fee, the stamp tax and the fixed costs', () => {
    expect(explainConcept('transfer', breakdown(), 920000)).toBe(
      'Arancel del registro (1,5%) + sellos de Córdoba (3%) sobre el valor del auto, más $ 80.000 de gastos fijos (formularios y verificación) = $ 920.000.',
    )
  })

  it('omits the province from the stamp tax when it was not recognized', () => {
    const transfer = { ...breakdown().transfer, province: 'Atlántida', province_known: false }
    expect(explainConcept('transfer', breakdown({ transfer }), 920000)).toContain(
      'sellos (3%)',
    )
  })

  it('explains the conversion of a price published in dollars', () => {
    expect(explainConcept('price', breakdown(), 24000000, { published: 20000, rate: 1200 })).toBe(
      'Precio publicado en US$ 20.000, convertido al dólar oficial venta de $ 1.200.',
    )
  })
})
