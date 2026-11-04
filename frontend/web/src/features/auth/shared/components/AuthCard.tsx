import { useEffect, useRef, type ReactNode } from 'react'
import styles from './AuthCard.module.css'

type Props = {
  title: string
  titleId: string
  subtitle?: string
  // Figma variant "Tipo=Registro concesionaria": 760 wide instead of 560, for the two-column form.
  wide?: boolean
  embedded?: boolean
  children: ReactNode
}

// Card shared by every auth screen: title row with the boxed wordmark, optional subtitle, then the content.
export default function AuthCard({ title, titleId, subtitle, wide = false, embedded = false, children }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (embedded) titleRef.current?.focus({ preventScroll: true })
  }, [embedded])

  return (
    <section className={[styles.card, wide && styles.wide, embedded && styles.embedded].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <div className={styles.titleRow}>
          <h1 id={titleId} className={styles.title} ref={titleRef} tabIndex={embedded ? -1 : undefined}>
            {title}
          </h1>
          {!embedded && <p className={styles.wordmark}>TD AUTOS</p>}
        </div>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}
