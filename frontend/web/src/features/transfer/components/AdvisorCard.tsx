import ButtonAnchor from '../../../components/Buttons/ButtonAnchor'
import { useId } from 'react'
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
      <ButtonAnchor
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        variant="primary" className={`${styles.link}`}
      >
        {ADVISOR_COPY.action}
      </ButtonAnchor>
    </section>
  )
}
