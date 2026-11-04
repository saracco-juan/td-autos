import { useState } from 'react'
import { Link } from 'react-router'
import type { FavoriteVehicle } from '@shared/favorites/types'
import buttonStyles from '../../components/button.module.css'
import { formatKilometers, formatPrice } from '../inventory/format'
import { COMBUSTIBLE_OPTIONS, TRANSMISION_OPTIONS } from '../inventory/vehicleFields'
import styles from './FavoriteCard.module.css'

function title(vehicle: FavoriteVehicle) {
  return [vehicle.marca, vehicle.modelo, vehicle.version, vehicle.anio]
    .filter((part) => part !== null && part !== '').join(' ')
}

export default function FavoriteCard({ vehicle, busy, onRemove, score, bestMatch = false }: {
  vehicle: FavoriteVehicle; busy: boolean; onRemove: () => void; score?: number; bestMatch?: boolean
}) {
  const name = title(vehicle)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  return (
    <li className={styles.card}>
      <h2 className={styles.title}>{name}</h2>
      <p className={styles.price}>{vehicle.precio === null || vehicle.moneda === null
        ? 'Precio no disponible' : formatPrice(vehicle.precio, vehicle.moneda)}</p>
      <p className={styles.price}>{score === undefined ? 'Compatibilidad no disponible'
        : `${score.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% de compatibilidad`}</p>
      <div className={styles.image}>
        {bestMatch ? <span className={styles.badge}>MEJOR COINCIDENCIA</span> : null}
        {vehicle.image_url && failedImage !== vehicle.image_url
          ? <img src={vehicle.image_url} alt={name} loading="lazy" onError={() => setFailedImage(vehicle.image_url)} />
          : <span>Imagen no disponible</span>}
      </div>
      <p className={styles.details}>
        {[TRANSMISION_OPTIONS.find((option) => option.value === vehicle.transmision)?.label,
          COMBUSTIBLE_OPTIONS.find((option) => option.value === vehicle.combustible)?.label,
          vehicle.kilometraje === null ? 'Kilometraje no disponible' : formatKilometers(vehicle.kilometraje)]
          .filter(Boolean).join(' · ')}
      </p>
      <div className={styles.actions}>
        <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.action}`}
          onClick={onRemove} disabled={busy} aria-busy={busy}>
          QUITAR
        </button>
        <Link className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.action}`}
          to={`/vehiculos/${vehicle.id}`} state={{ returnTo: '/favoritos' }}>
          VER FICHA
        </Link>
      </div>
    </li>
  )
}
