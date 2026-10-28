import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import {
  budgetPenaltyNote, compatibilityLabel, componentsSummary, displayScore, equivalentPriceLabel, recommendationTitle,
  warningMessages,
} from '@shared/recommendations/format'
import { formatKilometers, formatPrice } from '../inventory/format'
import { EQUIPMENT_GROUPS } from '@shared/vehicles/equipment'
import type { Recommendation } from './matching'
import PhotoPlaceholder from './PhotoPlaceholder'
import styles from './VehicleCard.module.css'

// High v3 Card/Vehicle (2373:7340); computation and eligibility stay in the backend.
export default function MatchingVehicleCard({ result, comparison }: {
  result: Recommendation; comparison?: { selected: boolean; toggle: () => void }
}) {
  const titleId = useId()
  const [photoFailed, setPhotoFailed] = useState(false)
  const location = useLocation()
  const { vehicle, dealer, components } = result
  const title = recommendationTitle(result)

  return (
    <li className={styles.card} aria-labelledby={titleId}>
      <p id={titleId} className={styles.title}>{title}</p>
      <p className={styles.meta}>{formatKilometers(vehicle.kilometraje)} · {vehicle.ubicacion}</p>
      {vehicle.image_url && !photoFailed ? (
        <img src={vehicle.image_url} alt={`Foto de ${title}`} loading="lazy" className={styles.image}
          onError={() => setPhotoFailed(true)} />
      ) : (
        <PhotoPlaceholder />
      )}
      <strong>{compatibilityLabel(result)}</strong>
      <p className={styles.meta}>Publicado: {formatPrice(result.published_price, result.published_currency)}</p>
      <p className={styles.meta}>{equivalentPriceLabel(result)}</p>
      <span className={styles.source}>{dealer.nombre} · {dealer.provincia}</span>
      <div className={styles.actions} role="group" aria-label={`Acciones de ${title}`}>
        {comparison ? <button type="button" className={buttonStyles.button} aria-pressed={comparison.selected}
          aria-label={`${comparison.selected ? 'Quitar' : 'Comparar'} ${title}`} onClick={comparison.toggle}>
          {comparison.selected ? 'QUITAR' : 'COMPARAR'}
        </button> : null}
        <Link to={`/vehiculos/${result.listing_id}`} className={`${buttonStyles.button} ${buttonStyles.primary}`}
          state={{ vehicleDetail: { listingId: result.listing_id, score: result.score,
            factors: components, returnTo: `${location.pathname}${location.search}` } }}>
          VER FICHA
        </Link>
      </div>
      {warningMessages(result).map((message) => <p key={message} className={alertStyles.warning}>{message}</p>)}
      <details className={styles.meta}>
        <summary>Ver atributos y motivos</summary>
        <p>{componentsSummary(result)}</p>
        {result.resale ? <p>Reventa: actividad DNRPA {result.resale.window_start ?? 'no disponible'} a {result.resale.window_end ?? 'no disponible'} ({result.resale.activity_score === null ? 'sin puntaje' : displayScore(result.resale.activity_score)}); puntaje de retención ACARA al {result.resale.source_date ?? 'no disponible'} ({result.resale.retention_score === null ? 'sin puntaje' : displayScore(result.resale.retention_score)}). Cada factor pesa 50% de la prioridad. Son referencias por antigüedad, no precios futuros garantizados.</p> : null}
        {result.resale?.model_match?.approximate ? <p>Referencia aproximada: {result.resale.model_match.reference_model}, inferida para {result.resale.model_match.listing_model} por compatibilidad técnica. No confirma que sean el mismo modelo; la retención usa esta referencia y la actividad DNRPA corresponde a la familia publicada.</p> : null}
        {result.resale?.estimate ? <p>Depreciación anual estimada: {displayScore(result.resale.estimate.annual_depreciation_percent)}%. Años de referencia: {result.resale.estimate.years_used.join(', ')}. Retención estimada a {result.resale.estimate.horizon_years} años: {displayScore(result.resale.estimate.retained_percent ?? result.resale.retention_score ?? 0)}%. Es una proyección con precios del catálogo, no una evolución histórica observada ni un precio futuro garantizado.</p> : null}
        {result.resale?.estimate?.retention_range ? <p>Estimación por grupo: {result.resale.estimate.reference_count} referencias compatibles. Rango estimado de retención: {displayScore(result.resale.estimate.retention_range[0])}% a {displayScore(result.resale.estimate.retention_range[1])}%. No identifica una versión exacta.</p> : null}
        <p>{budgetPenaltyNote(result)}</p>
        <p>Motor y capacidad: {vehicle.plazas} plazas · {vehicle.carroceria} · {vehicle.transmision === 'automatica' ? 'Automática' : 'Manual'} · {vehicle.combustible} · {vehicle.motor}{vehicle.turbo ? ' turbo' : ''} · {vehicle.potencia} {vehicle.potencia_unidad}</p>
        <p>Consumo: {vehicle.combustible === 'gnc' ? 'GNC: valoración de costo de uso, sin consumo físico comparable.' : `Urbano ${vehicle.consumo_urbano} / ruta ${vehicle.consumo_ruta} L/100 km`}</p>
        {Object.entries(EQUIPMENT_GROUPS).map(([group, fields]) => (
          <p key={group}>{group}: {fields.filter(([key]) => vehicle[key] === true).map(([, label]) => label).join(', ') || 'Ninguno de estos elementos'}</p>
        ))}
      </details>
    </li>
  )
}
