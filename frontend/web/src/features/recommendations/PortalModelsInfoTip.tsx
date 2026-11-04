import { PORTAL_MODELS_NOTICE } from '@shared/portals/format'
import InfoTip from '../../components/InfoTip'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { hasPortalModels, PORTAL_MESSAGE_WIDE_QUERY } from './portalMessage'
import type { PortalModelsView } from './portalModels'

// Narrow screens and phones: the models-not-units message lives in an info button at the end of the tabs row, so the
// grid never moves. Wide screens show it as a box in the left margin instead (PortalModelsPanel), never both.
export default function PortalModelsInfoTip({ view }: { view: PortalModelsView }) {
  const wide = useMediaQuery(PORTAL_MESSAGE_WIDE_QUERY)
  if (wide || !hasPortalModels(view)) return null
  return <InfoTip label="Sobre estos modelos">{PORTAL_MODELS_NOTICE}</InfoTip>
}
