import { useState } from 'react'
import PhotoPlaceholder from './PhotoPlaceholder'
import styles from './VehicleCard.module.css'

export default function CardPhotos({ photos, title }: { photos: string[]; title: string }) {
  const [selected, setSelected] = useState(0)
  const [failed, setFailed] = useState<string[]>([])
  const [animate, setAnimate] = useState(false)
  const [readyPhotos, setReadyPhotos] = useState<string[]>([])
  const [visited, setVisited] = useState([0])
  const [displayed, setDisplayed] = useState(0)
  // Virtual positions keep the same direction across the last/first photo boundary.
  const [indicator, setIndicator] = useState(0)
  const index = Math.min(selected, Math.max(0, photos.length - 1))
  const firstDot = -Math.min(2, Math.floor((photos.length - 1) / 2))
  const lastDot = Math.min(2, Math.ceil((photos.length - 1) / 2))
  const choose = (next: number, pointer: boolean) => {
    const target = ((next % photos.length) + photos.length) % photos.length
    const motion = pointer && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setIndicator((current) => current + next - index)
    setAnimate(motion)
    setSelected(target)
    setVisited((previous) => previous.includes(target) ? previous : [...previous, target])
    if (readyPhotos.includes(photos[target])) setDisplayed(target)
  }

  return (
    <div className={styles.imageWrapper}>
      {visited.filter((position) => photos[position] && !failed.includes(photos[position])).map((position) => (
        <img key={`${position}-${photos[position]}`} src={photos[position]}
          alt={position === index ? `Foto de ${title}` : ''} aria-hidden={position !== index} loading="lazy"
          className={`${styles.image} ${styles.photoLayer} ${styles.photoCurrent}`}
          data-animate={animate} data-ready={displayed === position && !failed.includes(photos[index])}
          onLoad={() => {
            setReadyPhotos((previous) => previous.includes(photos[position]) ? previous : [...previous, photos[position]])
            if (position === index) setDisplayed(position)
          }}
          onError={() => setFailed((previous) => [...previous, photos[position]])} />
      ))}
      {!photos[index] || failed.includes(photos[index]) ? <PhotoPlaceholder className={styles.placeholder} /> : null}
      {photos.length > 1 ? (
        <div className={styles.photoControls} data-animate={animate} role="group" aria-label={`Fotos de ${title}`}>
          <button type="button" aria-label="Foto anterior" onClick={(event) => choose(index - 1, event.detail > 0)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
          </button>
          <div className={styles.photoWindow}>
            <div className={styles.photoTrack}
              style={{ transform: `translateX(${48 - indicator * 24}px)` }}>
              {Array.from({ length: 7 }, (_, offset) => indicator + offset - 3).map((slot) => {
                const position = ((slot % photos.length) + photos.length) % photos.length
                const distance = slot - indicator
                const visible = distance >= firstDot && distance <= lastDot
                return (
                  <button key={slot} type="button" className={styles.photoDot}
                    aria-label={`Ver foto ${position + 1} de ${photos.length}`}
                    aria-pressed={distance === 0} aria-hidden={!visible}
                    tabIndex={visible ? 0 : -1}
                    style={{ left: slot * 24, visibility: visible ? 'visible' : 'hidden' }}
                    onClick={(event) => choose(index + distance, event.detail > 0)}>
                    <span aria-hidden="true" style={{ transform: `scale(${Math.max(0.35, 1 - Math.abs(distance) * 0.3)})`, opacity: Math.max(0.25, 1 - Math.abs(distance) * 0.3) }} />
                  </button>
                )
              })}
            </div>
          </div>
          <button type="button" aria-label="Foto siguiente" onClick={(event) => choose(index + 1, event.detail > 0)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5 7 7-7 7M5 12h14" /></svg>
          </button>
          <span className={styles.photoStatus} aria-live="polite">Foto {index + 1} de {photos.length}</span>
        </div>
      ) : null}
    </div>
  )
}
