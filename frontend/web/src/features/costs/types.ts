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
  patente: {
    base: number
    // acara: the base is the ACARA catalog value of the linked version; listing: the published price.
    base_source: 'acara' | 'listing'
    // Only with the acara source: the model year and the currency the catalog quotes.
    reference_year?: number
    reference_currency?: 'ARS' | 'USD'
    province: string
    province_known: boolean
    // scale: fixed + rate over the excess of the bracket; bracket_rate: one rate over the whole value; flat: one rate.
    method: 'scale' | 'bracket_rate' | 'flat'
    // The rate that applies: over the excess (scale) or over the whole value (bracket_rate, flat).
    rate: number
    // Scale only: the fixed amount of the bracket and the limit it starts at; null otherwise.
    bracket_fixed: number | null
    bracket_from: number | null
    annual: number
  }
  service: {
    // Brand with service data (the config's label); null when the brand is not in the table.
    brand: string | null
    brand_known: boolean
    // True when the price comes from the brand + model; false for brand + body type or the reference value.
    model_matched: boolean
    // Slug and label of the body type; null when the car's body type is not in the tables.
    body_type: BodyType | null
    body_label: string | null
    km_per_year: number
    interval_km: number
    interval_months: number
    services_per_year: number
    // ARS per service, CPI-indexed.
    price_per_service: number
    // 1 for nafta, diésel and híbrido; 1,15 for GNC; 0,5 for eléctrico.
    fuel_factor: number
    // "service oficial Toyota Yaris", "service oficial Toyota" or "valor de referencia".
    source_label: string
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
    total: number
    not_estimated: string[]
  }
  // The service is occasional: it only enters the yearly total (monthly total x 12 + service).
  yearly: { service: number; total: number }
  breakdown: CostBreakdown
  rates_updated_at: string
  exchange_rate: { sell: number; updated_at: string } | null
}

export type CostsQuery = { km?: number; coverage?: Coverage }
