import type { OwnershipCosts } from '@shared/costs/types'

// Same reference case as the web page tests (HU10-WEB).
export const costs = (): OwnershipCosts => ({
  vehicle: { id: 7, make: 'Toyota', model: 'Corolla', version: 'XEI', year: 2022, fuel: 'nafta', province: 'Córdoba',
    published_price: 20000000, published_currency: 'ARS' },
  inputs: { km_per_month: 1500, km_source: 'diagnostico', coverage: 'terceros_completo' },
  purchase: { price: 20000000, transfer: 700000, total: 20700000, budget: { max: 25000000, fits: true, difference: 4300000 } },
  monthly: { fuel: 120000, insurance: 96000, patente: 20000, total: 236000, not_estimated: [] },
  yearly: { service: 972000, total: 3804000 },
  breakdown: {
    fuel: { km_per_month: 1500, consumption_l_100km: 8, fuel_type: 'nafta', price_fuel_type: 'nafta', unit: 'litro', unit_price: 1000 },
    insurance: { coverage: 'terceros_completo', base: 20000000, floor: 46000, value_rate: 0.0037, zone_factor: 0.8,
      province: 'Córdoba', province_known: true, tr_ratio: null, terceros_completo: 96000 },
    patente: { base_source: 'listing', base: 20000000, province: 'Córdoba', province_known: true, method: 'bracket_rate', rate: 0.025,
      bracket_fixed: null, bracket_from: null, annual: 500000, age: 4, age_band: null, body_kind: null, subtotal: 500000, surcharge: 0,
      cap_rate: null, cap_applied: false, minimum: null, minimum_applied: false, exempt: false, exempt_from_age: null },
    service: { brand: 'Toyota', brand_known: true, model_matched: true, body_type: 'sedan', body_label: 'Sedán',
      km_per_year: 18000, interval_km: 10000, interval_months: 12, services_per_year: 2, price_per_service: 486000, fuel_factor: 1,
      source_label: 'service oficial Toyota Corolla XEI' },
    transfer: { base: 20000000, dnrpa_rate: 0.01, stamp_rate: 0.02, province: 'Córdoba', province_known: true, fixed_costs: 100000 },
    rounding: 1000,
  },
  rates_updated_at: '2026-10-23',
  exchange_rate: null,
})
