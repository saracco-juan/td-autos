import { useId } from 'react'
import buttonStyles from '../../components/button.module.css'
import { ADVISOR_COPY } from '@shared/checklist/transfer/copy'
import { advisorUrl } from '@shared/checklist/transfer/advisor'
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
      <p className={styles.eyebrow}>{ADVISOR_COPY.eyebrow}</p>
      <h2 id={titleId} className={styles.title}>
        {ADVISOR_COPY.title}
      </h2>
      <p className={styles.text}>{ADVISOR_COPY.text}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.link}`}
      >
        {ADVISOR_COPY.action}
      </a>
    </section>
  )
}
