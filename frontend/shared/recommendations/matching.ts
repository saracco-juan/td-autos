// GET /api/recomendaciones (HU05 stage 11), shared by web and mobile. Public facts only: the response never
// includes plates or private dealer contacts. `Facts` adds the optional matching facts each app knows how to show.
export type RecommendationVehicle = {
  marca: string
  modelo: string
  version: string | null
  anio: number
  kilometraje: number
  ubicacion: string
  transmision: 'manual' | 'automatica'
  combustible: 'nafta' | 'diesel' | 'gnc' | 'hibrido' | 'electrico'
  carroceria: string | null
  image_url: string | null
}

export type RecommendationWarning = 'body_mismatch' | 'budget_exceeded' | 'resale_unavailable' | 'resale_stale'

export type Recommendation<Facts extends object = Record<never, never>> = {
  listing_id: number
  is_favorite?: boolean
  score: number
  components: Record<'usage' | 'body' | 'comfort', number> & { priority: number | null }
  resale?: {
    activity_score: number | null; retention_score: number | null; source_date: string | null
    window_start: string | null; window_end: string | null; stale: boolean
    model_match?: { approximate: true; listing_model: string; reference_model: string } | null
    estimate?: { method: 'annualized'; horizon_years: number; annual_depreciation_percent: number; years_used: number[]
      retained_percent?: number; reference_count?: number; retention_range?: [number, number] } | null
  } | null
  published_price: number
  published_currency: 'ARS' | 'USD'
  price_ars: number
  price_usd: number | null
  budget_excess_percent: number
  budget_penalty: number
  warnings: RecommendationWarning[]
  vehicle: RecommendationVehicle & Partial<Facts>
  dealer: { id: number; nombre: string; provincia: string | null }
}

export type RecommendationStatus = 'ready' | 'diagnosis_incomplete' | 'resale_pending'

export type ExchangeRate = {
  quote: { sell: number; source: string; updated_at: string } | null
  stale: boolean
  warning: string | null
}

export type RecommendationsResponse<Facts extends object = Record<never, never>> = {
  status: RecommendationStatus
  results: Recommendation<Facts>[]
  exchange_rate: ExchangeRate | null
}

export const RECOMMENDATIONS_PATH = '/api/recomendaciones'
// docs/design.md "Lists and tables": a fixed page of nine cards, no size selector.
export const RECOMMENDATIONS_PER_PAGE = 9
