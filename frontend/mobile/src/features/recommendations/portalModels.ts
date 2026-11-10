import { PORTAL_MODELS_PATH, type PortalModelsResponse } from '@shared/portals/models'
import type { AuthFetch } from '../../lib/http'

export function fetchPortalModels(request: AuthFetch): Promise<PortalModelsResponse> {
  return request<PortalModelsResponse>(PORTAL_MODELS_PATH)
}
