import { describe, expect, it } from 'vitest'
import { explainConcept } from './explainConcept'
import type { CostBreakdown } from './types'

// The patente fields that stay neutral unless a rule fills them (the API always sends them).
const NEUTRAL = {
  age: 4, age_band: null, body_kind: null, subtotal: 0, surcharge: 0, cap_rate: null, cap_applied: false, minimum: null, minimum_applied: false,
  exempt: false, exempt_from_age: null,
}

const insurance = (changes: Partial<CostBreakdown['insurance']> = {}): CostBreakdown['insurance'] => ({
  coverage: 'terceros_completo', base: 23000000, body_type: 'hatchback', body_label: 'Hatchback', base_monthly: 103000,
  value_rate: 0.023, by_value: false, zone_factor: 0.8, province: 'Córdoba', province_known: true, tr_ratio: null,
  terceros_completo: 83000,
  ...changes,
})

const breakdown = (changes: Partial<CostBreakdown> = {}): CostBreakdown => ({
  fuel: { km_per_month: 1500, consumption_l_100km: 8, fuel_type: 'nafta', price_fuel_type: 'nafta', unit: 'litro', unit_price: 2125 },
  insurance: insurance(),
  patente: { ...NEUTRAL, base_source: 'listing' as const, base: 23000000, province: 'Córdoba', province_known: true, method: 'bracket_rate', rate: 0.03, bracket_fixed: null,
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
    const patente = { ...NEUTRAL, base_source: 'listing' as const, base: 20600000, province: 'Buenos Aires', province_known: true, method: 'scale' as const, rate: 0.03,
      bracket_fixed: 233000, bracket_from: 18700000, annual: 290000 }
    expect(explainConcept('patente', breakdown({ patente }), 25000)).toBe(
      'Patente en Buenos Aires: sobre el valor del auto ($ 20.600.000) corresponde $ 233.000 + 3% de lo que supera $ 18.700.000 = $ 290.000 al año, dividido 12 meses = $ 25.000 por mes.',
    )
  })

  it('explains the first bracket of the scale as a plain share of the value', () => {
    const patente = { ...NEUTRAL, base_source: 'listing' as const, base: 10000000, province: 'Buenos Aires', province_known: true, method: 'scale' as const, rate: 0.01,
      bracket_fixed: 0, bracket_from: 0, annual: 100000 }
    expect(explainConcept('patente', breakdown({ patente }), 9000)).toBe(
      'Patente en Buenos Aires: 1% del valor del auto ($ 10.000.000) = $ 100.000 al año, dividido 12 meses = $ 9.000 por mes.',
    )
  })

  it('explains the whole-value bracket rate in Argentine format', () => {
    const patente = { ...NEUTRAL, base_source: 'listing' as const, base: 20000000, province: 'Córdoba', province_known: true, method: 'bracket_rate' as const, rate: 0.025,
      bracket_fixed: null, bracket_from: null, annual: 500000 }
    expect(explainConcept('patente', breakdown({ patente }), 42000)).toBe(
      'Patente en Córdoba: 2,5% anual del valor del auto, dividido 12 meses = $ 42.000 por mes.',
    )
  })

  it('explains a flat patente with the provincial rate', () => {
    const patente = { ...NEUTRAL, base_source: 'listing' as const, base: 23000000, province: 'Mendoza', province_known: true, method: 'flat' as const, rate: 0.03,
      bracket_fixed: null, bracket_from: null, annual: 690000 }
    expect(explainConcept('patente', breakdown({ patente }), 58000)).toBe(
      'Alícuota anual de 3% en Mendoza, sobre el valor del auto, dividido 12 meses = $ 58.000 por mes.',
    )
  })

  it('omits the province name when it was not recognized', () => {
    const patente = { ...NEUTRAL, base_source: 'listing' as const, base: 23000000, province: 'Atlántida', province_known: false, method: 'flat' as const, rate: 0.035,
      bracket_fixed: null, bracket_from: null, annual: 805000 }
    expect(explainConcept('patente', breakdown({ patente }), 68000)).toBe(
      'Alícuota anual de 3,5% sobre el valor del auto, dividido 12 meses = $ 68.000 por mes.',
    )
  })

  it('says the ACARA reference value of the version when the patente uses it', () => {
    const acara = { ...NEUTRAL, base_source: 'acara' as const, reference_year: 2022, reference_currency: 'USD' as const }
    const scale = { ...acara, base: 30000000, province: 'Buenos Aires', province_known: true, method: 'scale' as const, rate: 0.03,
      bracket_fixed: 233000, bracket_from: 18700000, annual: 566000 }
    expect(explainConcept('patente', breakdown({ patente: scale }), 47000)).toBe(
      'Patente en Buenos Aires: sobre el valor de referencia ACARA de esta versión ($ 30.000.000) corresponde $ 233.000 + 3% de lo que supera $ 18.700.000 = $ 566.000 al año, dividido 12 meses = $ 47.000 por mes.',
    )
    const plain = { ...scale, rate: 0.01, bracket_fixed: 0, bracket_from: 0, annual: 300000 }
    expect(explainConcept('patente', breakdown({ patente: plain }), 25000)).toBe(
      'Patente en Buenos Aires: 1% del valor de referencia ACARA de esta versión ($ 30.000.000) = $ 300.000 al año, dividido 12 meses = $ 25.000 por mes.',
    )
    const cordoba = { ...acara, base: 30000000, province: 'Córdoba', province_known: true, method: 'bracket_rate' as const, rate: 0.03,
      bracket_fixed: null, bracket_from: null, annual: 900000 }
    expect(explainConcept('patente', breakdown({ patente: cordoba }), 75000)).toBe(
      'Patente en Córdoba: 3% anual del valor de referencia ACARA de esta versión ($ 30.000.000), dividido 12 meses = $ 75.000 por mes.',
    )
    const flat = { ...cordoba, province: 'Mendoza', method: 'flat' as const, rate: 0.03 }
    expect(explainConcept('patente', breakdown({ patente: flat }), 75000)).toBe(
      'Alícuota anual de 3% en Mendoza, sobre el valor de referencia ACARA de esta versión ($ 30.000.000), dividido 12 meses = $ 75.000 por mes.',
    )
  })

  it('explains that an old enough vehicle pays no patente', () => {
    const patente = { ...NEUTRAL, base_source: 'listing' as const, base: 5000000, province: 'CABA', province_known: true, method: 'exempt' as const, rate: 0,
      bracket_fixed: null, bracket_from: null, age: 27, exempt: true, exempt_from_age: 25, annual: 0 }
    expect(explainConcept('patente', breakdown({ patente }), 0)).toBe(
      'Patente en CABA: el auto tiene 27 años y desde los 25 años no se paga patente = $ 0 por mes.',
    )
  })

  it('explains the surcharge of the scale', () => {
    const patente = { ...NEUTRAL, base_source: 'listing' as const, base: 38985600, province: 'CABA', province_known: true, method: 'scale' as const, rate: 0.065,
      bracket_fixed: 1477000, bracket_from: 36550000, subtotal: 1635314, surcharge: 0.1, cap_rate: 0.06, minimum: 13300, annual: 1798845.4 }
    expect(explainConcept('patente', breakdown({ patente }), 150000)).toBe(
      'Patente en CABA: sobre el valor del auto ($ 38.985.600) corresponde $ 1.477.000 + 6,5% de lo que supera $ 36.550.000 = $ 1.635.314, más 10% de recargo = $ 1.798.845 al año, dividido 12 meses = $ 150.000 por mes.',
    )
  })

  it('explains the cap as a share of the value', () => {
    const patente = { ...NEUTRAL, base_source: 'listing' as const, base: 100000000, province: 'CABA', province_known: true, method: 'scale' as const, rate: 0.08,
      bracket_fixed: 3965000, bracket_from: 73100000, subtotal: 6117000, surcharge: 0.1, cap_rate: 0.06, cap_applied: true, minimum: 13300, annual: 6000000 }
    expect(explainConcept('patente', breakdown({ patente }), 500000)).toBe(
      'Patente en CABA: sobre el valor del auto ($ 100.000.000) corresponde $ 3.965.000 + 8% de lo que supera $ 73.100.000 = $ 6.117.000, más 10% de recargo = $ 6.728.700, pero el tope es 6% del valor: $ 6.000.000 al año, dividido 12 meses = $ 500.000 por mes.',
    )
  })

  it('explains the annual minimum', () => {
    const patente = { ...NEUTRAL, base_source: 'listing' as const, base: 500000, province: 'CABA', province_known: true, method: 'scale' as const, rate: 0.016,
      bracket_fixed: 0, bracket_from: 0, subtotal: 8000, surcharge: 0.1, cap_rate: 0.06, minimum: 13300, minimum_applied: true, annual: 13300 }
    expect(explainConcept('patente', breakdown({ patente }), 2000)).toBe(
      'Patente en CABA: 1,6% del valor del auto ($ 500.000) = $ 8.000, más 10% de recargo = $ 8.800, pero el mínimo es $ 13.300: $ 13.300 al año, dividido 12 meses = $ 2.000 por mes.',
    )
  })

  it('explains the rate by age band of the car', () => {
    const base = { ...NEUTRAL, base_source: 'listing' as const, base: 20000000, province: 'Santa Fe', province_known: true, method: 'age_rate' as const,
      bracket_fixed: null, bracket_from: null }
    const first = { ...base, rate: 0.023, age: 3, age_band: { from_age: 0, to_age: 5 }, annual: 460000 }
    const middle = { ...base, rate: 0.02, age: 8, age_band: { from_age: 6, to_age: 10 }, annual: 400000 }
    const last = { ...base, rate: 0.018, age: 14, age_band: { from_age: 11, to_age: null }, annual: 360000 }
    expect(explainConcept('patente', breakdown({ patente: first }), 39000)).toBe(
      'Patente en Santa Fe: 2,3% anual del valor del auto, por ser un auto de hasta 5 años, dividido 12 meses = $ 39.000 por mes.',
    )
    expect(explainConcept('patente', breakdown({ patente: middle }), 34000)).toBe(
      'Patente en Santa Fe: 2% anual del valor del auto, por ser un auto de más de 5 y hasta 10 años, dividido 12 meses = $ 34.000 por mes.',
    )
    expect(explainConcept('patente', breakdown({ patente: last }), 30000)).toBe(
      'Patente en Santa Fe: 1,8% anual del valor del auto, por ser un auto de más de 10 años, dividido 12 meses = $ 30.000 por mes.',
    )
  })

  it('explains the rate by body type', () => {
    const base = { ...NEUTRAL, base_source: 'listing' as const, base: 20000000, province: 'Misiones', province_known: true, method: 'body_rate' as const,
      bracket_fixed: null, bracket_from: null }
    const utility = { ...base, rate: 0.008, body_kind: 'utility' as const, annual: 160000 }
    const car = { ...base, rate: 0.02, body_kind: 'car' as const, annual: 400000 }
    expect(explainConcept('patente', breakdown({ patente: utility }), 14000)).toBe(
      'Patente en Misiones: 0,8% anual del valor del auto, por ser una pickup o un SUV, dividido 12 meses = $ 14.000 por mes.',
    )
    expect(explainConcept('patente', breakdown({ patente: car }), 34000)).toBe(
      'Patente en Misiones: 2% anual del valor del auto, por ser un auto, dividido 12 meses = $ 34.000 por mes.',
    )
  })

  it('keeps the ACARA wording together with a rate by age', () => {
    const patente = { ...NEUTRAL, base_source: 'acara' as const, reference_year: 2022, reference_currency: 'ARS' as const, base: 30000000, province: 'Santa Fe',
      province_known: true, method: 'age_rate' as const, rate: 0.02, age: 8, age_band: { from_age: 6, to_age: 10 }, bracket_fixed: null, bracket_from: null,
      annual: 600000 }
    expect(explainConcept('patente', breakdown({ patente }), 50000)).toBe(
      'Patente en Santa Fe: 2% anual del valor de referencia ACARA de esta versión ($ 30.000.000), por ser un auto de más de 5 y hasta 10 años, dividido 12 meses = $ 50.000 por mes.',
    )
  })

  it('keeps the listing wording when the patente uses the listing price', () => {
    const cordoba = { ...NEUTRAL, base_source: 'listing' as const, base: 20000000, province: 'Córdoba', province_known: true, method: 'bracket_rate' as const,
      rate: 0.025, bracket_fixed: null, bracket_from: null, annual: 500000 }
    expect(explainConcept('patente', breakdown({ patente: cordoba }), 42000)).not.toMatch(/ACARA/)
  })

  it('never mentions maximums or rounding in the patente text', () => {
    const scale = { ...NEUTRAL, base_source: 'listing' as const, base: 20600000, province: 'Buenos Aires', province_known: true, method: 'scale' as const, rate: 0.03,
      bracket_fixed: 233000, bracket_from: 18700000, annual: 290000 }
    for (const patente of [scale, { ...scale, base_source: 'acara' as const }, breakdown().patente]) {
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
