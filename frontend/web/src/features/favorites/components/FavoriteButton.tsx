import alertStyles from '../../../styles/alert.module.css'
import { useFavorite } from '../hooks/useFavorite'
import styles from './FavoriteButton.module.css'

export default function FavoriteButton({ vehicleId, vehicleName, isFavorite = false }: {
  vehicleId: number
  vehicleName: string
  isFavorite?: boolean
}) {
  const favorite = useFavorite(vehicleId, isFavorite)
  const [animate, setAnimate] = useState(false)
  const label = favorite.isFavorite ? `Quitar ${vehicleName} de favoritos` : `Guardar ${vehicleName} en favoritos`

  return (
    <>
      <button type="button" className={styles.button} aria-label={label} aria-pressed={favorite.isFavorite}
        data-animate={animate} disabled={favorite.pending} onClick={(event) => {
          setAnimate(event.detail > 0 && !favorite.isFavorite)
          void favorite.toggle()
        }}>
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24"
          className={styles.heart}
          fill={favorite.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
      </button>
      {favorite.error ? <span role="alert" className={alertStyles.alert}>{favorite.error}</span> : null}
    </>
  )
}
import { useState } from 'react'
