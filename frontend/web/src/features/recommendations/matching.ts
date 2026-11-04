import type {
  Recommendation as SharedRecommendation,
  RecommendationsResponse as SharedRecommendationsResponse,
} from '@shared/recommendations/matching'
import { RECOMMENDATIONS_PATH } from '@shared/recommendations/matching'
import { apiFetch } from '../../lib/http'
import type { MatchingFacts } from '../inventory/matchingFields'

// The response types live in frontend/shared; web cards also read the optional matching facts.
export type Recommendation = SharedRecommendation<MatchingFacts>
export type RecommendationsResponse = SharedRecommendationsResponse<MatchingFacts>

export function fetchRecommendations(): Promise<RecommendationsResponse> {
  return apiFetch<RecommendationsResponse>(RECOMMENDATIONS_PATH)
}
