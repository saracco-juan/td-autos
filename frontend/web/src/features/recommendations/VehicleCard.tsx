import { useId } from 'react'
import { listingMeta, listingTitle } from './format'
import styles from './VehicleCard.module.css'
import type { Listing } from './types'

// One listing (Figma 38:168 "Card/Vehicle"). Match percentage, COMPARAR and VER FICHA wait for their own stories (HU05, HU08, HU09);
// the source tag takes the place of the match line so the buyer sees where the listing comes from.
export default function VehicleCard({ listing }: { listing: Listing }) {
  const titleId = useId()
  const title = listingTitle(listing)
  const meta = listingMeta(listing)

  return (
    <li className={styles.card} aria-labelledby={titleId}>
      <p id={titleId} className={styles.title}>
        {title}
      </p>
      {meta ? <p className={styles.meta}>{meta}</p> : null}
      {listing.imagen_url ? (
        <img src={listing.imagen_url} alt={`Foto de ${title}`} loading="lazy" className={styles.image} />
      ) : (
        <div className={`${styles.image} ${styles.placeholder}`}>Sin imagen</div>
      )}
      <span className={styles.source}>{listing.fuente.nombre}</span>
    </li>
  )
}
