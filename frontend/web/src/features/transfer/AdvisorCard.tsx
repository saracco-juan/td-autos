import { useId } from 'react'
import buttonStyles from '../../components/button.module.css'
import { advisorUrl } from './advisor'
import styles from './AdvisorCard.module.css'

type Props = {
  // Digits only, as the API sends them.
  whatsapp: string
}

// RF36: the paperwork advisor who pays to appear here. The chat opens in a new tab.
export default function AdvisorCard({ whatsapp }: Props) {
  const titleId = useId()
  const href = advisorUrl(whatsapp)
  if (href === null) return null

  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <p className={styles.eyebrow}>ASESORAMIENTO</p>
      <h2 id={titleId} className={styles.title}>
        ¿Preferís que te acompañen?
      </h2>
      <p className={styles.text}>
        Un asesor de trámites te guía paso a paso por WhatsApp, sin costo por la consulta inicial.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.link}`}
      >
        HABLAR CON UN ASESOR
      </a>
    </section>
  )
}
