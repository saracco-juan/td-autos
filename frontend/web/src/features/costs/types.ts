export type Coverage = 'terceros_completo' | 'todo_riesgo'

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
  rates_updated_at: string
  exchange_rate: { sell: number; updated_at: string } | null
}

export type CostsQuery = { km?: number; coverage?: Coverage }
