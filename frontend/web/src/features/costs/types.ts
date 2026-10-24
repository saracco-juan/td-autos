export type Coverage = 'terceros_completo' | 'todo_riesgo'

export type BodyType = 'hatchback' | 'sedan' | 'rural' | 'suv' | 'pickup' | 'furgon'

export type FuelType = 'nafta' | 'diesel' | 'gnc' | 'hibrido' | 'electrico'

// The inputs and rates behind each amount, so the screen can explain every figure with this vehicle's numbers.
export type CostBreakdown = {
  fuel: {
    km_per_month: number
    consumption_l_100km: number
    fuel_type: FuelType
    price_fuel_type: 'nafta' | 'diesel' | 'gnc'
    unit: 'litro' | 'm3'
    unit_price: number
  } | null
  insurance: {
    coverage: Coverage
    base: number
    // Slug and label of the body type; null when the car's body type is not in the insurance table.
    body_type: BodyType | null
    body_label: string | null
    // Monthly reference amount of the body type, CPI-indexed, before the zone factor.
    base_monthly: number
    // Yearly fraction of the price used when the price decides (2,3% terceros completo, 5,3% todo riesgo).
    value_rate: number
    by_value: boolean
    zone_factor: number
    province: string
    province_known: boolean
    // Todo riesgo only: the multiple of terceros completo.
    tr_ratio: number | null
    // Terceros completo as shown on the screen (the base of todo riesgo).
    terceros_completo: number
  }
  patente: { base: number; province: string; province_known: boolean; annual_rate: number }
  maintenance: {
    fuel_type: FuelType
    annual_base: number
    age_years: number
    age_factor: number
    km: number
    km_factor: number
    turbo_factor: number | null
    automatic_factor: number | null
  }
  transfer: {
    base: number
    dnrpa_rate: number
    stamp_rate: number
    province: string
    province_known: boolean
    fixed_costs: number
  }
  rounding: number
}

export type OwnershipCosts = {
  vehicle: {
    id: number
    make: string
    model: string
    version: string | null
    year: number
    // The vehicle's combustible; null when the listing has none.
    fuel: FuelType | null
    province: string | null
    published_price: number
    published_currency: 'ARS' | 'USD'
  }
  inputs: { km_per_month: number; km_source: 'diagnostico' | 'default' | 'usuario'; coverage: Coverage }
  purchase: {
    price: number
    transfer: number
    total: number
    budget: { max: number; fits: boolean; difference: number } | null
  }
  monthly: {
    fuel: number | null
    insurance: number
    patente: number
    maintenance: number
    total: number
    yearly_total: number
    not_estimated: string[]
  }
  breakdown: CostBreakdown
  rates_updated_at: string
  exchange_rate: { sell: number; updated_at: string } | null
}

export type CostsQuery = { km?: number; coverage?: Coverage }
