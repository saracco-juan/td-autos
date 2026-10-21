import { apiFetch } from '../../lib/http'
import type { MatchingFacts } from '../inventory/matchingFields'
import type { Vehiculo } from '../inventory/types'

// Public facts only: the recommendation response never includes plates or private dealer contacts.
export type Recommendation = {
  listing_id: number
  score: number
  components: Record<'usage' | 'body' | 'priority' | 'comfort', number>
  published_price: number
  published_currency: 'ARS' | 'USD'
  price_ars: number
  price_usd: number | null
  budget_excess_percent: number
  budget_penalty: number
  warnings: ('body_mismatch' | 'budget_exceeded')[]
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
