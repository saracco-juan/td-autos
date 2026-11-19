import ButtonAnchor from '../../../components/Buttons/ButtonAnchor'
import { useId, useState } from 'react'
import {
  PORTAL_FILTERS_HEADING, PORTAL_KAVAK_NOTE, PORTAL_REASONS_HEADING, portalButtonLabel, portalInfoLabel,
  portalLinkName, portalModelTitle, portalPriceRange, portalPriceYear, portalYearsLabel,
} from '@shared/portals/format'
import type { PortalModel } from '@shared/portals/models'
import InfoTip from '../../../components/InfoTip/InfoTip'
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

// Shares the photo treatment with dealership cards; the listings stay in the portals.
export default function PortalModelCard({ model }: { model: PortalModel }) {
  const titleId = useId()
  const filtersId = useId()
  const [photoFailed, setPhotoFailed] = useState(false)
  const title = portalModelTitle(model)
  return (
    <li className={cardStyles.card} aria-labelledby={titleId}>
      <div className={cardStyles.surface}>
        <div className={cardStyles.imageWrapper}>
          {model.imagen_url && !photoFailed ? (
            <img src={model.imagen_url} alt={title} loading="lazy" className={cardStyles.image}
              onError={() => setPhotoFailed(true)} />
          ) : <PhotoPlaceholder />}
        </div>
        <div className={cardStyles.content}>
          <div className={styles.titleRow}>
            <p id={titleId} className={cardStyles.title}>{title}</p>
            <InfoTip label={portalInfoLabel(model)}>
              <strong className={styles.heading}>{PORTAL_REASONS_HEADING}</strong>
              <ul className={styles.reasons} aria-label="Motivos">
                {model.motivos.map((reason) => <li key={reason}><CheckIcon />{reason}</li>)}
              </ul>
              <strong id={filtersId} className={styles.heading}>{PORTAL_FILTERS_HEADING}</strong>
              <ul className={styles.chips} aria-labelledby={filtersId}>
                {model.filtros.map((filter) => <li key={filter}>{filter}</li>)}
              </ul>
              <span className={styles.note}>{PORTAL_KAVAK_NOTE}</span>
            </InfoTip>
          </div>
          <p className={cardStyles.meta}>{portalYearsLabel(model.anios)}</p>
          <p className={cardStyles.price}>{portalPriceRange(model.precio)}</p>
          <p className={cardStyles.meta}>{portalPriceYear(model.precio)}</p>
          {model.carroceria ? <p className={cardStyles.source}>{model.carroceria}</p> : null}
          <fieldset className={`${cardStyles.actions} ${cardStyles.portalActions}`} aria-label={`Acciones de ${title}`}>
            {model.links.map((link) => (
              <ButtonAnchor key={link.portal} href={link.url} target="_blank" rel="noopener noreferrer"
                className={`${cardStyles.detail}`} aria-label={portalLinkName(link, model)}>
                {portalButtonLabel(link)}
              </ButtonAnchor>
            ))}
          </fieldset>
        </div>
      </div>
    </li>
  )
}
