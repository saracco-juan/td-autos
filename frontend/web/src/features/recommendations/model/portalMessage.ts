import type { PortalModelsView } from '../api/portalModels'

// Large displays show the explanatory note inline; smaller screens use the info control.
export const PORTAL_MESSAGE_WIDE_QUERY = '(min-width: 1800px)'

// The models-not-units message only accompanies a list that has models.
export function hasPortalModels(view: PortalModelsView): boolean {
  return view.status === 'ready' && view.response.modelos.length > 0
}
