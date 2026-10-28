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
    // Monthly floor of terceros completo at AMBA prices (ARS), CPI-indexed, before the value share and the zone factor.
    floor: number
    // Fraction of the price added to the floor per MONTH (0,37%); never indexed.
    value_rate: number
    // Multiplies floor + value share; 1 in Buenos Aires and CABA, the default zone for a province without a published range.
    zone_factor: number
    province: string
    province_known: boolean
    // Todo riesgo only: the multiple of the terceros completo shown (1,5).
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
    // scale: fixed + rate over the excess of the bracket; bracket_rate: one rate over the whole value; age_rate: the rate
    // of the age band of a car; body_rate: the rate of pickups and SUVs or of cars; flat: one rate; exempt: pays nothing.
    method: 'scale' | 'bracket_rate' | 'age_rate' | 'body_rate' | 'flat' | 'exempt'
    // The rate that applies: over the excess (scale) or over the whole value (the rest). 0 when exempt.
    rate: number
    // Scale only: the fixed amount of the bracket and the limit it starts at; null otherwise.
    bracket_fixed: number | null
    bracket_from: number | null
    // Years since the model year (never negative).
    age: number
    // age_rate only: the band the car falls in (to_age null = no upper limit); null otherwise.
    age_band: { from_age: number; to_age: number | null } | null
    // body_rate only: whether the rate is the one of utility vehicles (the province's utility bodies) or of cars; null otherwise.
    body_kind: 'utility' | 'car' | null
    // The tax of the scheme, before the surcharge, the cap and the minimum.
    subtotal: number
    // Fraction added on top of the tax (0 when the province has none).
    surcharge: number
    // Maximum tax as a fraction of the value, and whether it reduced the tax; null when the province has no cap.
    cap_rate: number | null
    cap_applied: boolean
    // Minimum tax per year in ARS, and whether it raised the tax; null when the province has no minimum.
    minimum: number | null
    minimum_applied: boolean
    // Exempt vehicles (age >= exempt_from_age) pay nothing; exempt_from_age is null when the province has no exemption.
    exempt: boolean
    exempt_from_age: number | null
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
