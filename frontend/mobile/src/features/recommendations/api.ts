import type { AuthFetch } from '../../lib/http'
import { RECOMMENDATIONS_PATH, type RecommendationsResponse } from '@shared/recommendations/matching'

// `request` is the session's authFetch (useAuth): the backend reads the signed-in user's saved diagnosis.
export function fetchRecommendations(request: AuthFetch): Promise<RecommendationsResponse> {
  return request<RecommendationsResponse>(RECOMMENDATIONS_PATH)
}
