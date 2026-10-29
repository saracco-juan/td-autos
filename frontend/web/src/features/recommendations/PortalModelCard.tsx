import { useId, useState } from 'react'
import {
  PORTAL_DETAILS_SUMMARY, PORTAL_FILTERS_HEADING, PORTAL_KAVAK_NOTE, PORTAL_PHOTO_PILL, portalButtonLabel,
  portalLinkName, portalModelTitle, portalPriceRange, portalPriceYear, portalYearsLabel,
} from '@shared/portals/format'
import type { PortalModel } from '@shared/portals/models'
import buttonStyles from '../../components/button.module.css'
import PhotoPlaceholder from './PhotoPlaceholder'
import cardStyles from './VehicleCard.module.css'
import styles from './PortalModels.module.css'

function CheckIcon() {
  return (
    <svg className={styles.check} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Mirrors MatchingVehicleCard (same classes, same order); the listings stay in the portals.
export default function PortalModelCard({ model }: { model: PortalModel }) {
  const titleId = useId()
  const headingId = useId()
  const [photoFailed, setPhotoFailed] = useState(false)
  const title = portalModelTitle(model)
  const photo = photoFailed ? null : model.imagen
  return (
    <li className={cardStyles.card} aria-labelledby={titleId}>
      <p id={titleId} className={cardStyles.title}>{title}</p>
      <p className={cardStyles.meta}>{portalYearsLabel(model.anios)}</p>
      {photo ? (
        <div className={styles.media}>
          <img src={photo.url} alt={title} loading="lazy" className={cardStyles.image}
            onError={() => setPhotoFailed(true)} />
          <span className={styles.pill}>{PORTAL_PHOTO_PILL}</span>
        </div>
      ) : <PhotoPlaceholder />}
      <strong>{portalPriceRange(model.precio)}</strong>
      <p className={cardStyles.meta}>{portalPriceYear(model.precio)}</p>
      {model.carroceria ? <span className={cardStyles.source}>{model.carroceria}</span> : null}
      <div className={cardStyles.actions} role="group" aria-label={`Acciones de ${title}`}>
        {model.links.map((link) => (
          <a key={link.portal} href={link.url} target="_blank" rel="noopener noreferrer"
            className={`${buttonStyles.button} ${buttonStyles.secondary}`} aria-label={portalLinkName(link, model)}>
            {portalButtonLabel(link)}
          </a>
        ))}
      </div>
      <details className={cardStyles.meta}>
        <summary>{PORTAL_DETAILS_SUMMARY}</summary>
        <ul className={styles.reasons} aria-label="Motivos">
          {model.motivos.map((reason) => <li key={reason}><CheckIcon />{reason}</li>)}
        </ul>
        <p id={headingId} className={styles.heading}>{PORTAL_FILTERS_HEADING}</p>
        <ul className={styles.chips} aria-labelledby={headingId}>
          {model.filtros.map((filter) => <li key={filter}>{filter}</li>)}
        </ul>
        <p>{PORTAL_KAVAK_NOTE}</p>
      </details>
    </li>
  )
}
