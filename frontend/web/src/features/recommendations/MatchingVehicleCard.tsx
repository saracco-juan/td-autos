import { useId } from 'react'
import { Link, useLocation } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import InfoTip from '../../components/InfoTip'
import {
  compatibilityLabel, displayScore, equivalentPriceLabel, recommendationTitle,
  warningMessages,
} from '@shared/recommendations/format'
import { formatKilometers, formatPrice } from '../inventory/format'
import FavoriteButton from '../favorites/FavoriteButton'
import type { Recommendation } from './matching'
import CardPhotos from './CardPhotos'
import styles from './VehicleCard.module.css'

// Photo-led redesign of High v3 Card/Vehicle (2373:7340); matching stays in the backend.
export default function MatchingVehicleCard({ result, comparison, priorityLabel }: {
  result: Recommendation; comparison?: { selected: boolean; toggle: () => void }; priorityLabel?: string
}) {
  const titleId = useId()
  const location = useLocation()
  const { vehicle, dealer, components } = result
  const title = recommendationTitle(result)

  return (
    <li className={styles.card} aria-labelledby={titleId}>
      <div className={styles.surface}>
        <CardPhotos title={title} photos={vehicle.image_urls?.length ? vehicle.image_urls : vehicle.image_url ? [vehicle.image_url] : []} />
        <div className={styles.topline}>
          <div className={styles.matchingInfo}>
            <strong className={styles.compatibility}>{compatibilityLabel(result)}</strong>
            <InfoTip label={`Por qué recomendamos ${title}`}>
              <strong>Por qué se recomienda</strong>
              <p className={styles.reasonIntro}>Coincidencia con tu diagnóstico:</p>
              <dl className={styles.reasonScores}>
                {([
                  ['Uso', components.usage], ['Carrocería', components.body],
                  [priorityLabel, components.priority], ['Confort', components.comfort],
                ] as const).map(([label, score]) => label ? (
                  <div key={label}><dt>{label}</dt><dd>{score === null ? 'Sin datos' : `${displayScore(score)}/100`}</dd></div>
                ) : null)}
              </dl>
              {result.budget_penalty > 0 ? <p className={styles.reasonNote}>Presupuesto: −{displayScore(result.budget_penalty)} puntos.</p> : null}
              <p className={styles.reasonNote}>Atributos y detalle de la evaluación en la ficha.</p>
            </InfoTip>
            {result.warnings.includes('body_mismatch') ? (
              <span className={styles.bodyWarning}>
                <InfoTip label={`Advertencia de carrocería de ${title}`}>
                  No coincide con la carrocería elegida.
                </InfoTip>
              </span>
            ) : null}
          </div>
          <div className={styles.favorite}><FavoriteButton vehicleId={result.listing_id}
            vehicleName={title} isFavorite={result.is_favorite ?? false} /></div>
        </div>
        <div className={styles.content}>
          <p id={titleId} className={styles.title}>{title}</p>
          <p className={styles.meta}>{formatKilometers(vehicle.kilometraje)} · {vehicle.ubicacion}</p>
          <p className={styles.price}>Publicado: {formatPrice(result.published_price, result.published_currency).replace('US$', 'USD')}</p>
          <p className={styles.meta}>{equivalentPriceLabel(result).replace('US$', 'USD')}</p>
          <p className={styles.source}>{dealer.nombre} · {dealer.provincia}</p>
          <div className={styles.actions} role="group" aria-label={`Acciones de ${title}`}>
            {comparison ? <button type="button" className={`${buttonStyles.button} ${styles.compare}`} aria-pressed={comparison.selected}
              aria-label={`${comparison.selected ? 'Quitar' : 'Comparar'} ${title}`} onClick={comparison.toggle}>
              {comparison.selected ? 'QUITAR' : 'COMPARAR'}
            </button> : null}
            <Link to={`/vehiculos/${result.listing_id}`} className={`${buttonStyles.button} ${styles.detail}`}
              state={{ vehicleDetail: { listingId: result.listing_id, score: result.score,
                factors: components, returnTo: `${location.pathname}${location.search}` } }}>
              VER FICHA
            </Link>
          </div>
        </div>
      </div>
      {warningMessages({ ...result, warnings: result.warnings.filter((warning) => warning !== 'body_mismatch') }).map((message) => <p key={message} className={alertStyles.warning}>{message}</p>)}

    </li>
  )
}
