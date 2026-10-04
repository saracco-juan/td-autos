import type { ReactNode } from 'react'
import styles from './AuthCard.module.css'

type Props = {
  title: string
  titleId: string
  subtitle?: string
  children: ReactNode
}

// Card shared by every auth screen: title row with the boxed wordmark, optional subtitle, then the content.
export default function AuthCard({ title, titleId, subtitle, children }: Props) {
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <div className={styles.titleRow}>
          <h1 id={titleId} className={styles.title}>
            {title}
          </h1>
          <p className={styles.wordmark}>TD AUTOS</p>
        </div>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}
