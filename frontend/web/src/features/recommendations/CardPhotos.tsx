import { useState } from 'react'
import PhotoPlaceholder from './PhotoPlaceholder'
import styles from './VehicleCard.module.css'

export default function CardPhotos({ photos, title }: { photos: string[]; title: string }) {
  const [selected, setSelected] = useState(0)
  const [failed, setFailed] = useState<string[]>([])
  const [animate, setAnimate] = useState(false)
  const index = Math.min(selected, Math.max(0, photos.length - 1))
  const start = Math.max(0, Math.min(index - 1, photos.length - 3))
  const choose = (next: number, pointer: boolean) => {
    setAnimate(pointer)
    setSelected((next + photos.length) % photos.length)
  }

  return (
    <div className={styles.imageWrapper}>
      {photos[index] && !failed.includes(photos[index]) ? (
        <img key={photos[index]} src={photos[index]} alt={`Foto de ${title}`} loading="lazy"
          className={`${styles.image} ${animate ? styles.photoEnter : ''}`}
          onError={() => setFailed((previous) => [...previous, photos[index]])} />
      ) : <PhotoPlaceholder className={styles.placeholder} />}
      {photos.length > 1 ? (
        <div className={styles.photoControls} role="group" aria-label={`Fotos de ${title}`}>
          <button type="button" aria-label="Foto anterior" onClick={(event) => choose(index - 1, event.detail > 0)}>
            <span aria-hidden="true">‹</span>
          </button>
          {photos.slice(start, start + 3).map((url, offset) => (
            <button key={url} type="button" className={styles.photoDot}
              aria-label={`Ver foto ${start + offset + 1} de ${photos.length}`}
              aria-pressed={index === start + offset}
              onClick={(event) => choose(start + offset, event.detail > 0)}>
              <span aria-hidden="true" />
            </button>
          ))}
          <button type="button" aria-label="Foto siguiente" onClick={(event) => choose(index + 1, event.detail > 0)}>
            <span aria-hidden="true">›</span>
          </button>
          <span className={styles.photoStatus} aria-live="polite">Foto {index + 1} de {photos.length}</span>
        </div>
      ) : null}
    </div>
  )
}
