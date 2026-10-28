import { useId } from 'react'
import {
  PORTAL_FILTERS_HEADING, PORTAL_KAVAK_NOTE, portalButtonLabel, portalLinkName, portalModelTitle, portalPriceLabel,
  portalYearsLabel,
} from '@shared/portals/format'
import type { PortalModel } from '@shared/portals/models'
import buttonStyles from '../../components/button.module.css'
import cardStyles from './VehicleCard.module.css'
import styles from './PortalModels.module.css'

// A curated model with the searches already built for each portal. No photo: the portals own the listings.
export default function PortalModelCard({ model }: { model: PortalModel }) {
  const titleId = useId()
  const headingId = useId()
  return (
    <li className={cardStyles.card} aria-labelledby={titleId}>
      <p id={titleId} className={cardStyles.title}>{portalModelTitle(model)}</p>
      <p className={cardStyles.meta}>{portalYearsLabel(model.anios)}</p>
      <strong>{portalPriceLabel(model.precio)}</strong>
      <ul className={styles.reasons} aria-label="Motivos">
        {model.motivos.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <p id={headingId} className={cardStyles.meta}>{PORTAL_FILTERS_HEADING}</p>
      <ul className={styles.chips} aria-labelledby={headingId}>
        {model.filtros.map((filter) => <li key={filter} className={cardStyles.source}>{filter}</li>)}
      </ul>
      <div className={`${cardStyles.actions} ${styles.actions}`}>
        {model.links.map((link) => (
          <a key={link.portal} href={link.url} target="_blank" rel="noopener noreferrer"
            className={`${buttonStyles.button} ${buttonStyles.secondary}`} aria-label={portalLinkName(link, model)}>
            {portalButtonLabel(link)}
          </a>
        ))}
      </div>
      <p className={cardStyles.meta}>{PORTAL_KAVAK_NOTE}</p>
    </li>
  )
}
