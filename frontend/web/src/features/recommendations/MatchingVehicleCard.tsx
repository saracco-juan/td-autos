import { useId } from 'react'
import alertStyles from '../../components/alert.module.css'
import { formatKilometers, formatPrice } from '../inventory/format'
import { EQUIPMENT_GROUPS } from '../inventory/matchingFields'
import type { Recommendation } from './matching'
import styles from './VehicleCard.module.css'

const displayScore = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 1 })

// High v3 Card/Vehicle (2373:7340); computation and eligibility stay in the backend.
export default function MatchingVehicleCard({ result }: { result: Recommendation }) {
  const titleId = useId()
  const { vehicle, dealer, components } = result
  const title = [vehicle.marca, vehicle.modelo, vehicle.version, vehicle.anio].filter(Boolean).join(' ')
  const equivalent = result.published_currency === 'USD' ? result.price_ars : result.price_usd
  const currency = result.published_currency === 'USD' ? 'ARS' : 'USD'

  return (
    <li className={styles.card} aria-labelledby={titleId}>
      <p id={titleId} className={styles.title}>{title}</p>
      <p className={styles.meta}>{formatKilometers(vehicle.kilometraje)} · {vehicle.ubicacion}</p>
      {vehicle.image_url ? (
        <img src={vehicle.image_url} alt={`Foto de ${title}`} loading="lazy" className={styles.image} />
      ) : (
        <div className={`${styles.image} ${styles.placeholder}`}>Sin imagen</div>
      )}
      <strong>{displayScore(result.score)}% de compatibilidad</strong>
      <p className={styles.meta}>Publicado: {formatPrice(result.published_price, result.published_currency)}</p>
      <p className={styles.meta}>
        {equivalent === null ? 'Equivalente en USD no disponible.' : `Equivalente: ${formatPrice(equivalent, currency)}`}
      </p>
      <span className={styles.source}>{dealer.nombre} · {dealer.provincia}</span>
      {result.warnings.includes('budget_exceeded') ? (
        <p className={alertStyles.warning}>Supera tu presupuesto en {displayScore(result.budget_excess_percent)}%.</p>
      ) : null}
      {result.warnings.includes('body_mismatch') ? (
        <p className={alertStyles.warning}>No coincide con la carrocería elegida.</p>
      ) : null}
      {result.warnings.includes('resale_unavailable') ? (
        <p className={alertStyles.warning}>Sin estimación de reventa: compatibilidad parcial sobre los factores conocidos, con descuento de 10 puntos por falta de datos, no por mala reventa.</p>
      ) : null}
      {result.warnings.includes('resale_stale') ? <p className={alertStyles.warning}>Reventa calculada con la última evidencia disponible; actualización pendiente.</p> : null}
      <details className={styles.meta}>
        <summary>Ver atributos y motivos</summary>
        <p>Uso: {displayScore(components.usage)} · Carrocería: {displayScore(components.body)} · Prioridad: {components.priority === null ? 'no disponible' : displayScore(components.priority)} · Confort: {displayScore(components.comfort)} (sobre 100).</p>
        {result.resale ? <p>Reventa: actividad DNRPA {result.resale.window_start ?? 'no disponible'} a {result.resale.window_end ?? 'no disponible'} ({result.resale.activity_score === null ? 'sin puntaje' : displayScore(result.resale.activity_score)}); retención ACARA al {result.resale.source_date ?? 'no disponible'} ({result.resale.retention_score === null ? 'sin puntaje' : displayScore(result.resale.retention_score)}). Cada factor pesa 50% de la prioridad. Son referencias por antigüedad de la misma versión, no precios futuros garantizados.</p> : null}
        {result.resale?.estimate ? <p>Depreciación anual estimada: {displayScore(result.resale.estimate.annual_depreciation_percent)}%. Años de referencia: {result.resale.estimate.years_used.join(', ')}. Retención estimada a {result.resale.estimate.horizon_years} años: {result.resale.retention_score === null ? 'sin puntaje' : displayScore(result.resale.retention_score)} sobre 100. Es una proyección con precios del catálogo, no una evolución histórica observada ni un precio futuro garantizado.</p> : null}
        <p>Descuento por presupuesto: {displayScore(result.budget_penalty)} puntos. La compatibilidad expresa nuestras reglas, no una probabilidad de satisfacción.</p>
        <p>Motor y capacidad: {vehicle.plazas} plazas · {vehicle.carroceria} · {vehicle.transmision === 'automatica' ? 'Automática' : 'Manual'} · {vehicle.combustible} · {vehicle.motor}{vehicle.turbo ? ' turbo' : ''} · {vehicle.potencia} {vehicle.potencia_unidad}</p>
        <p>Consumo: {vehicle.combustible === 'gnc' ? 'GNC: valoración de costo de uso, sin consumo físico comparable.' : `Urbano ${vehicle.consumo_urbano} / ruta ${vehicle.consumo_ruta} L/100 km`}</p>
        {Object.entries(EQUIPMENT_GROUPS).map(([group, fields]) => (
          <p key={group}>{group}: {fields.filter(([key]) => vehicle[key] === true).map(([, label]) => label).join(', ') || 'Ninguno de estos elementos'}</p>
        ))}
      </details>
    </li>
  )
}
