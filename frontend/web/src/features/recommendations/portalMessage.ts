import type { PortalModelsView } from './portalModels'

// From this width on the page has a free margin at the left of the 1200 px column, wide enough for the message box.
export const PORTAL_MESSAGE_WIDE_QUERY = '(min-width: 1800px)'

// The models-not-units message only accompanies a list that has models.
export function hasPortalModels(view: PortalModelsView): boolean {
  return view.status === 'ready' && view.response.modelos.length > 0
}
