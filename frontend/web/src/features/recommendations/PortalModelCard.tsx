import { useId, useState } from 'react'
import {
  PORTAL_FILTERS_HEADING, PORTAL_KAVAK_NOTE, PORTAL_PRICE_LABEL, portalButtonLabel, portalLinkName, portalModelTitle,
  portalPhotoCredit, portalPriceRange, portalPriceYear, portalYearsLabel,
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

// A curated model with its credited photo and the searches already built for each portal. The listings stay in the portals.
export default function PortalModelCard({ model }: { model: PortalModel }) {
  const titleId = useId()
  const headingId = useId()
  const [photoFailed, setPhotoFailed] = useState(false)
  const title = portalModelTitle(model)
  const photo = photoFailed ? null : model.imagen
  return (
    <li className={styles.card} aria-labelledby={titleId}>
      <figure className={styles.media}>
        {photo ? (
          <>
            <img src={photo.url} alt={title} loading="lazy" className={`${cardStyles.image} ${styles.photo}`}
              onError={() => setPhotoFailed(true)} />
            <figcaption className={styles.credit}>
              <a href={photo.pagina} target="_blank" rel="noopener noreferrer">{portalPhotoCredit(photo)}</a>
            </figcaption>
          </>
        ) : <PhotoPlaceholder className={styles.photo} />}
      </figure>
      <div className={styles.head}>
        <p id={titleId} className={`${cardStyles.title} ${styles.title}`}>{title}</p>
        <span className={styles.years}>{portalYearsLabel(model.anios)}</span>
      </div>
      <div className={styles.price}>
        <p className={cardStyles.meta}>{PORTAL_PRICE_LABEL}</p>
        <p className={styles.range}>{portalPriceRange(model.precio)}</p>
        <p className={cardStyles.meta}>{portalPriceYear(model.precio)}</p>
      </div>
      <ul className={styles.reasons} aria-label="Motivos">
        {model.motivos.map((reason) => <li key={reason}><CheckIcon />{reason}</li>)}
      </ul>
      <div className={styles.filters}>
        <p id={headingId} className={cardStyles.meta}>{PORTAL_FILTERS_HEADING}</p>
        <ul className={styles.chips} aria-labelledby={headingId}>
          {model.filtros.map((filter) => <li key={filter}>{filter}</li>)}
        </ul>
      </div>
      <div className={`${cardStyles.actions} ${styles.actions}`}>
        {model.links.map((link) => (
          <a key={link.portal} href={link.url} target="_blank" rel="noopener noreferrer"
            className={`${buttonStyles.button} ${buttonStyles.secondary}`} aria-label={portalLinkName(link, model)}>
            {portalButtonLabel(link)}
          </a>
        ))}
      </div>
      <p className={`${cardStyles.meta} ${styles.note}`}>{PORTAL_KAVAK_NOTE}</p>
    </li>
  )
}
