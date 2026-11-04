import Button from '../../../components/Buttons/Button'
import ButtonLink from '../../../components/Buttons/ButtonLink'
import { useId } from 'react'
import type { FavoriteVehicle } from '@shared/favorites/types'
import { formatKilometers, formatPrice } from '../../inventory/format'
import { COMBUSTIBLE_OPTIONS, TRANSMISION_OPTIONS } from '../../inventory/vehicleFields'
import CardPhotos from '../../recommendations/CardPhotos'
import styles from '../../recommendations/VehicleCard.module.css'
import favoriteStyles from './FavoriteCard.module.css'

function title(vehicle: FavoriteVehicle) {
  return [vehicle.marca, vehicle.modelo, vehicle.version, vehicle.anio]
    .filter((part) => part !== null && part !== '').join(' ')
}

export default function FavoriteCard({ vehicle, busy, onRemove, score, bestMatch = false, comparison }: {
  vehicle: FavoriteVehicle; busy: boolean; onRemove: () => void; score?: number; bestMatch?: boolean
  comparison?: { selected: boolean; toggle: () => void }
}) {
  const name = title(vehicle)
  const titleId = useId()
  return (
    <li className={styles.card} aria-labelledby={titleId}>
      <div className={styles.surface}>
        <CardPhotos title={name} photos={vehicle.image_url ? [vehicle.image_url] : []} />
        <div className={styles.topline}>
          <div className={favoriteStyles.badges}>
            <span className={styles.compatibility}>{score === undefined ? 'Compatibilidad no disponible'
              : `${score.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% de compatibilidad`}</span>
            {bestMatch ? <span className={favoriteStyles.bestMatch}>MEJOR COINCIDENCIA</span> : null}
          </div>
        </div>
        <div className={styles.content}>
          <h2 id={titleId} className={styles.title}>{name}</h2>
          <p className={styles.meta}>
            {[TRANSMISION_OPTIONS.find((option) => option.value === vehicle.transmision)?.label,
              COMBUSTIBLE_OPTIONS.find((option) => option.value === vehicle.combustible)?.label,
              vehicle.kilometraje === null ? 'Kilometraje no disponible' : formatKilometers(vehicle.kilometraje)]
              .filter(Boolean).join(' · ')}
          </p>
          <p className={styles.price}>{vehicle.precio === null || vehicle.moneda === null
            ? 'Precio no disponible' : <>Publicado: <span>{formatPrice(vehicle.precio, vehicle.moneda).replace('US$', 'USD')}</span></>}</p>
          <p className={styles.meta}>{vehicle.ubicacion || 'Ubicación no disponible'}</p>
          <div className={`${styles.actions} ${favoriteStyles.actions}`} role="group" aria-label={`Acciones de ${name}`}>
            {comparison ? <Button type="button" className={`${styles.compare}`}
              aria-pressed={comparison.selected} disabled={busy}
              aria-label={`${comparison.selected ? 'Dejar de comparar' : 'Comparar'} ${name}`} onClick={comparison.toggle}>
              {comparison.selected ? 'SELECCIONADO' : 'COMPARAR'}
            </Button> : null}
            <Button type="button" className={`${styles.compare}`}
              onClick={onRemove} disabled={busy} aria-busy={busy}>
              QUITAR
            </Button>
            <ButtonLink className={`${styles.detail}`}
              to={`/vehiculos/${vehicle.id}`} state={{ returnTo: '/favoritos' }}>
              VER FICHA
            </ButtonLink>
          </div>
        </div>
      </div>
    </li>
  )
}
