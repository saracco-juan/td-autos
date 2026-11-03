import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { FavoriteVehicle } from '@shared/favorites/types'
import buttonStyles from '../../components/button.module.css'
import type { Recommendation } from '../recommendations/matching'
import FavoriteCard from './FavoriteCard'
import styles from './FavoritesCarousel.module.css'

type Props = {
  items: FavoriteVehicle[]; matches: Recommendation[]; selectedIds: number[]; pendingIds: number[]
  onToggle: (id: number) => void; onRemove: (vehicle: FavoriteVehicle) => void
}

export default function FavoritesCarousel({ items, matches, selectedIds, pendingIds, onToggle, onRemove }: Props) {
  const [compact, setCompact] = useState(() => window.matchMedia?.('(max-width: 1100px)').matches ?? false)
  const [index, setIndex] = useState(0)
  const [instant, setInstant] = useState(false)
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const length = items.length
  const available = items.filter((vehicle) => !selectedIds.includes(vehicle.id))
  const startIndex = length ? ((index % length) + length) % length : 0
  const currentIndex = length ? (Array.from({ length }, (_, step) => (startIndex + step) % length)
    .find((candidate) => !selectedIds.includes(items[candidate].id)) ?? 0) : 0
  const currentId = items[currentIndex]?.id
  const currentTurn = length ? index + (currentIndex - startIndex + length) % length : 0
  const selected = selectedIds.flatMap((id) => items.filter((vehicle) => vehicle.id === id))

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 1100px)')
    const update = () => setCompact(media?.matches ?? false)
    media?.addEventListener?.('change', update)
    return () => media?.removeEventListener?.('change', update)
  }, [])

  const navigate = (delta: number, fromKeyboard = false) => {
    if (length < 2) return
    setIndex(() => {
      let next = currentTurn
      for (let step = 0; step < length; step += 1) {
        next += delta
        if (!selectedIds.includes(items[((next % length) + length) % length]?.id)) return next
      }
      return currentTurn
    })
    if (fromKeyboard) {
      setInstant(true)
      window.setTimeout(() => setInstant(false), 40)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1, true) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1, true) }
  }
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, a, input, select')) return
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = pointer.current
    pointer.current = null
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) navigate(dx < 0 ? 1 : -1)
  }

  const renderCard = (vehicle: FavoriteVehicle) => <FavoriteCard key={vehicle.id} vehicle={vehicle}
    busy={pendingIds.includes(vehicle.id)} onRemove={() => onRemove(vehicle)}
    score={matches.find((match) => match.listing_id === vehicle.id)?.score}
    bestMatch={matches[0]?.listing_id === vehicle.id}
    comparison={{ selected: selectedIds.includes(vehicle.id), toggle: () => onToggle(vehicle.id) }} />

  if (compact) return <ul className={styles.grid} aria-label="Vehículos favoritos">
    {items.map(renderCard)}
  </ul>

  return <section className={`${styles.carousel} ${instant ? styles.instant : ''} ${selected.length ? styles.hasSelected : ''}`}
    role="region" aria-label="Carrusel de favoritos" aria-roledescription="carrusel" tabIndex={0}
    data-current-id={currentId} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { pointer.current = null }}>
    <div className={styles.stage}>
      <div className={styles.deck}>
        {items.map((vehicle, itemIndex) => {
          const selectedIndex = selected.findIndex((item) => item.id === vehicle.id)
          const offset = ((itemIndex - currentIndex + length + Math.floor(length / 2)) % length) - Math.floor(length / 2)
          // Keep complete turns: wrapping the angle would make a card sweep across the front.
          const angle = (itemIndex - currentTurn) * 360 / length
          const radians = angle * Math.PI / 180
          const isSelected = selectedIndex >= 0
          const lift = isSelected ? 0 : -165 * (1 - Math.cos(radians))
          const facing = isSelected ? 0 : 14 * Math.sin(radians)
          const radius = isSelected ? '0px' : 'var(--orbit-radius)'
          const x = isSelected ? `calc(-50% + ${selectedIndex === 0 ? -200 : 200}px)` : '-50%'
          const y = isSelected ? '-520px' : `calc(var(--wheel-y) + ${lift}px)`
          // Keep the same transform functions while lifting out of the orbit.
          const orbit = `translate(${x}, ${y}) translateZ(calc(-1 * ${radius})) rotateY(${angle}deg) translateZ(${radius}) rotateY(${-angle}deg) rotateY(${facing}deg)`
          const position = selectedIndex >= 0 ? `selected-${selectedIndex}` : offset === 0 ? 'front'
            : `side-${offset}`
          const active = offset === 0 || selectedIndex >= 0
          const side = selectedIndex < 0 && offset !== 0
          return <div key={vehicle.id} className={styles.card} data-position={position} data-active={active}
            style={{ transform: orbit, zIndex: isSelected ? 30 : Math.round(10 + 5 * Math.cos(radians)) }}>
            <div aria-hidden={side ? true : undefined} inert={side ? true : undefined}>
              {renderCard(vehicle)}
            </div>
            {side ? <button type="button" className={styles.sideTarget}
              aria-label={`Ver ${vehicle.marca} ${vehicle.modelo} ${vehicle.version ?? ''} ${vehicle.anio}`}
              onClick={() => {
                const distance = ((itemIndex - currentIndex + length + Math.floor(length / 2)) % length) - Math.floor(length / 2)
                setIndex(currentTurn + distance)
              }}>Ver vehículo</button> : null}
          </div>
        })}
      </div>
      {selected.length > 0 ? <div className={styles.selected} role="group" aria-label="Vehículos seleccionados" /> : null}
    </div>
    <div className={styles.controls}>
      <button type="button" className={`${buttonStyles.button} ${styles.arrow}`} aria-label="Anterior favorito" disabled={available.length < 2} onClick={() => navigate(-1)}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <span aria-live="polite">{length ? `${currentIndex + 1} de ${length}` : 'Sin favoritos'}</span>
      <button type="button" className={`${buttonStyles.button} ${styles.arrow}`} aria-label="Siguiente favorito" disabled={available.length < 2} onClick={() => navigate(1)}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  </section>
}
