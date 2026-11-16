import { useEffect, useId, useRef, useState } from 'react'
import { diagnosisSummaryRows } from '@shared/diagnosis/diagnosisDraft'
import type { BodyType, SavedDiagnosis } from '@shared/diagnosis/types'
import Button from '../../../components/Buttons/Button'
import styles from './DiagnosisPopover.module.css'

type Props = {
  diagnosis: SavedDiagnosis
  bodyTypes: BodyType[]
  /** Lets the page give the trigger the same size as its neighbour button. */
  className?: string
}

// "TU DIAGNÓSTICO" button with a non-modal panel under it, over the content: the answers saved in the diagnosis,
// one row per question. Second click, Escape (focus returns to the button) and a pointer down outside close it.
export default function DiagnosisPopover({ diagnosis, bodyTypes, className }: Readonly<Props>) {
  const panelId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    const onPointer = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div ref={root} className={styles.root}>
      <Button ref={trigger} type="button" variant="secondary" className={className}
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
        TU DIAGNÓSTICO
        <svg className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} viewBox="0 0 12 12"
          width="12" height="12" aria-hidden="true" focusable="false">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
      {open ? (
        <div id={panelId} role="dialog" aria-label="Tu diagnóstico" className={styles.panel}>
          <dl className={styles.rows}>
            {diagnosisSummaryRows(diagnosis, bodyTypes).map(({ label, value }) => (
              <div key={label} className={styles.row}>
                <dt className={styles.label}>{label}</dt>
                <dd className={styles.value}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}
