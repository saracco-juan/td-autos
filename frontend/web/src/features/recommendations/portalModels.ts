import { PORTAL_MODELS_PATH, type PortalModelsResponse } from '@shared/portals/models'
import type { ErrorKind } from '../../components/ErrorState'
import { apiFetch } from '../../lib/http'

// The curated-model recommendations load on their own, so a failure here never touches the dealers tab.
export type PortalModelsView =
  | { status: 'loading' }
  | { status: 'error'; kind: ErrorKind }
  | { status: 'ready'; response: PortalModelsResponse }

export function fetchPortalModels(): Promise<PortalModelsResponse> {
  return apiFetch<PortalModelsResponse>(PORTAL_MODELS_PATH)
}
