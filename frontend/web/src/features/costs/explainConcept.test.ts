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
  patente: { base: 23000000, province: 'Córdoba', province_known: true, method: 'bracket_rate', rate: 0.03, bracket_fixed: null,
    bracket_from: null, annual: 690000 },
  service: { brand: 'Toyota', brand_known: true, model_matched: true, body_type: 'hatchback', body_label: 'Hatchback',
    km_per_year: 18000, interval_km: 10000, interval_months: 12, services_per_year: 2, price_per_service: 361000, fuel_factor: 1,
    source_label: 'service oficial Toyota Yaris' },
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

  it('explains the patente scale with the bracket fixed amount, the rate and the excess', () => {
    const patente = { base: 20600000, province: 'Buenos Aires', province_known: true, method: 'scale' as const, rate: 0.03,
      bracket_fixed: 233000, bracket_from: 18700000, annual: 290000 }
    expect(explainConcept('patente', breakdown({ patente }), 25000)).toBe(
      'Patente en Buenos Aires: sobre el valor del auto ($ 20.600.000) corresponde $ 233.000 + 3% de lo que supera $ 18.700.000 = $ 290.000 al año, dividido 12 meses = $ 25.000 por mes.',
    )
  })

  it('explains the first bracket of the scale as a plain share of the value', () => {
    const patente = { base: 10000000, province: 'Buenos Aires', province_known: true, method: 'scale' as const, rate: 0.01,
      bracket_fixed: 0, bracket_from: 0, annual: 100000 }
    expect(explainConcept('patente', breakdown({ patente }), 9000)).toBe(
      'Patente en Buenos Aires: 1% del valor del auto ($ 10.000.000) = $ 100.000 al año, dividido 12 meses = $ 9.000 por mes.',
    )
  })

  it('explains the whole-value bracket rate in Argentine format', () => {
    const patente = { base: 20000000, province: 'Córdoba', province_known: true, method: 'bracket_rate' as const, rate: 0.025,
      bracket_fixed: null, bracket_from: null, annual: 500000 }
    expect(explainConcept('patente', breakdown({ patente }), 42000)).toBe(
      'Patente en Córdoba: 2,5% anual del valor del auto, dividido 12 meses = $ 42.000 por mes.',
    )
  })

  it('explains a flat patente with the provincial rate', () => {
    const patente = { base: 23000000, province: 'Mendoza', province_known: true, method: 'flat' as const, rate: 0.03,
      bracket_fixed: null, bracket_from: null, annual: 690000 }
    expect(explainConcept('patente', breakdown({ patente }), 58000)).toBe(
      'Alícuota anual de 3% en Mendoza, sobre el valor del auto, dividido 12 meses = $ 58.000 por mes.',
    )
  })

  it('omits the province name when it was not recognized', () => {
    const patente = { base: 23000000, province: 'Atlántida', province_known: false, method: 'flat' as const, rate: 0.035,
      bracket_fixed: null, bracket_from: null, annual: 805000 }
    expect(explainConcept('patente', breakdown({ patente }), 68000)).toBe(
      'Alícuota anual de 3,5% sobre el valor del auto, dividido 12 meses = $ 68.000 por mes.',
    )
  })

  it('never mentions maximums or rounding in the patente text', () => {
    const scale = { base: 20600000, province: 'Buenos Aires', province_known: true, method: 'scale' as const, rate: 0.03,
      bracket_fixed: 233000, bracket_from: 18700000, annual: 290000 }
    for (const patente of [scale, breakdown().patente]) {
      expect(explainConcept('patente', breakdown({ patente }), 25000)).not.toMatch(/máxim|más alt|hasta|redonde|techo/i)
    }
  })

  it('explains the service with the km rule, the price and where it comes from', () => {
    expect(explainConcept('service', breakdown(), 722000)).toBe(
      '18.000 km al año ÷ 10.000 km = 2 services × $ 361.000 (service oficial Toyota Yaris) = $ 722.000 al año.',
    )
  })

  it('says "al menos" when the time rule decides', () => {
    const service = { ...breakdown().service, km_per_year: 6000, services_per_year: 1 }
    expect(explainConcept('service', breakdown({ service }), 361000)).toBe(
      'Al menos 1 service por año × $ 361.000 (service oficial Toyota Yaris) = $ 361.000 al año.',
    )
    const twice = { ...service, interval_months: 6, services_per_year: 2 }
    expect(explainConcept('service', breakdown({ service: twice }), 722000)).toContain('Al menos 2 services por año')
  })

  it('uses the singular for a single service on the km rule', () => {
    const service = { ...breakdown().service, km_per_year: 10000, services_per_year: 1 }
    expect(explainConcept('service', breakdown({ service }), 361000)).toContain('10.000 km al año ÷ 10.000 km = 1 service ×')
  })

  it('adds the GNC and electric factors only when they apply', () => {
    const named = (fuel_factor: number) =>
      explainConcept('service', breakdown({ service: { ...breakdown().service, fuel_factor } }), 830000)
    expect(named(1.15)).toContain('(service oficial Toyota Yaris) × 1,15 por GNC = $ 830.000 al año.')
    expect(named(0.5)).toContain('× 0,5 por ser eléctrico')
    expect(named(1)).not.toMatch(/GNC|eléctrico/)
  })

  it('names the body type when the price is a reference value', () => {
    const service = { ...breakdown().service, brand: null, brand_known: false, model_matched: false,
      price_per_service: 200000, source_label: 'valor de referencia' }
    expect(explainConcept('service', breakdown({ service }), 400000)).toBe(
      '18.000 km al año ÷ 10.000 km = 2 services × $ 200.000 (valor de referencia para un hatchback) = $ 400.000 al año.',
    )
  })

  it('leaves the body type out of a reference value when it is unknown', () => {
    const service = { ...breakdown().service, body_type: null, body_label: null, price_per_service: 400000,
      source_label: 'valor de referencia' }
    expect(explainConcept('service', breakdown({ service }), 800000)).toContain('× $ 400.000 (valor de referencia) =')
  })

  it('never mentions maximums, ceilings or rounding in the service text', () => {
    for (const fuel_factor of [1, 1.15, 0.5]) {
      for (const source_label of ['service oficial Toyota Yaris', 'valor de referencia']) {
        const service = { ...breakdown().service, fuel_factor, source_label }
        expect(explainConcept('service', breakdown({ service }), 722000)).not.toMatch(/máxim|más alt|hasta|redonde|techo/i)
      }
    }
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
