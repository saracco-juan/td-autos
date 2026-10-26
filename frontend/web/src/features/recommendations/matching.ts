import { apiFetch } from '../../lib/http'
import type { MatchingFacts } from '../inventory/matchingFields'
import type { Vehiculo } from '../inventory/types'

// Public facts only: the recommendation response never includes plates or private dealer contacts.
export type Recommendation = {
  listing_id: number
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
  warnings: ('body_mismatch' | 'budget_exceeded' | 'resale_unavailable' | 'resale_stale')[]
  vehicle: Pick<Vehiculo, 'marca' | 'modelo' | 'version' | 'anio' | 'kilometraje' | 'ubicacion' | 'transmision' | 'combustible'> &
    Partial<MatchingFacts> & { carroceria: string | null; image_url: string | null }
  dealer: { id: number; nombre: string; provincia: string | null }
}

export type RecommendationsResponse = {
  status: 'ready' | 'diagnosis_incomplete' | 'resale_pending'
  results: Recommendation[]
  exchange_rate: { quote: { sell: number; source: string; updated_at: string } | null; stale: boolean; warning: string | null } | null
}

export function fetchRecommendations(): Promise<RecommendationsResponse> {
  return apiFetch<RecommendationsResponse>('/api/recomendaciones')
}
