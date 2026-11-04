import { useState } from 'react'
import type { DetailVehicle } from '@shared/vehicles/detail'
import buttonStyles from '../../components/button.module.css'
import styles from './VehicleGallery.module.css'

type Props = { photos: DetailVehicle['fotos']; title: string }

export default function VehicleGallery({ photos, title }: Props) {
  const [selectedId, setSelectedId] = useState(photos[0]?.id)
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const selected = photos.find((photo) => photo.id === selectedId) ?? photos[0]
  const index = photos.findIndex((photo) => photo.id === selected?.id)
  const markFailed = (url: string) => setFailed((previous) => new Set(previous).add(url))

  return (
    <section aria-label="Fotos del vehículo" className={styles.gallery}>
      {!selected || failed.has(selected.url) ? (
        <div className={`${styles.cover} ${styles.placeholder}`} role="status">
          {selected ? 'Esta foto no está disponible.' : 'Fotos no disponibles.'}
        </div>
      ) : (
        <img className={styles.cover} src={selected.url} alt={`Foto ${index + 1} de ${title}`}
          onError={() => markFailed(selected.url)} />
      )}
      {photos.length > 0 ? (
        <div className={styles.thumbnails} role="group" aria-label="Elegí una foto">
          {photos.map((photo, position) => (
            <button type="button" key={photo.id}
              className={`${buttonStyles.button} ${styles.thumbnail}`}
              aria-label={`Ver foto ${position + 1} de ${title}`}
              aria-pressed={photo.id === selected?.id} onClick={() => setSelectedId(photo.id)}>
              {failed.has(photo.url) ? <span>Foto {position + 1} no disponible</span> : (
                <img src={photo.url} alt="" loading="lazy" onError={() => markFailed(photo.url)} />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
