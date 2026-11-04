import { PORTAL_MODELS_PATH, type PortalModelsResponse } from '@shared/portals/models'
import { apiFetch } from '../../lib/http'
import type { ApiView } from './useApiView'

// The curated-model recommendations load on their own, so a failure here never touches the dealers tab.
export type PortalModelsView = ApiView<PortalModelsResponse>

export function fetchPortalModels(): Promise<PortalModelsResponse> {
  return apiFetch<PortalModelsResponse>(PORTAL_MODELS_PATH)
}
