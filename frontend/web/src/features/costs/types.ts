export type Coverage = 'terceros_completo' | 'todo_riesgo'

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
  insurance: { base: number; coverage: Coverage; annual_rate: number }
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
