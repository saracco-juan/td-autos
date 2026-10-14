import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import screenStyles from '../../components/screen.module.css'
import { HttpError, NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import Field from '../auth/shared/Field'
import fieldStyles from '../auth/shared/authForm.module.css'
import { formatSentDate } from '../subscription/format'
import { approveReceipt, fetchReceipt, rejectReceipt } from './api'
import { dealerLocation, dealerState, formatDay, receiptState, receiptTone, validateRejectReason } from './format'
import ReceiptPreview from './ReceiptPreview'
import styles from './ReceiptReviewPage.module.css'
import type { AdminReceipt } from './types'

type LoadState = 'loading' | 'missing' | { error: ErrorKind } | { receipt: AdminReceipt }

type Decision = 'approve' | 'reject'

const PENDING = 'pendiente de revisión'
const REASON_LABEL = 'Motivo de rechazo (obligatorio para rechazar)'
const SAVE_ERROR = 'No pudimos guardar la decisión. Intentá nuevamente.'
const ALREADY_REVIEWED = 'Este comprobante ya fue revisado.'
const RESULT: Record<Decision, string> = {
  approve: 'Aprobaste el comprobante. Le avisamos a la concesionaria por email.',
  reject: 'Rechazaste el comprobante. Le avisamos a la concesionaria por email.',
}

type ValidationBody = { errors?: { motivo_rechazo?: string[] } }

function InfoCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function BackLink() {
  return (
    <Link to="/admin/concesionarias" className={styles.backLink}>
      <span aria-hidden="true" className={styles.backIcon}>
        ‹
      </span>
      Volver a concesionarias
    </Link>
  )
}

// The outcome of a decided receipt, at the top of the screen (Figma has no such state):
// red with the reason when rejected, green when approved.
function OutcomeBanner({ receipt }: { receipt: AdminReceipt }) {
  const rejected = receipt.estado === 'rechazado'
  const date = receipt.fecha_revision ? ` el ${formatSentDate(receipt.fecha_revision)}` : ''
  return (
    <section
      aria-labelledby="receipt-outcome"
      className={`${rejected ? alertStyles.alert : alertStyles.notice} ${styles.outcome}`}
      data-tone={receiptTone(receipt.estado)}
    >
      <h2 id="receipt-outcome" className={styles.outcomeTitle}>
        {rejected ? 'Comprobante rechazado' : 'Comprobante aprobado'}
      </h2>
      <p className={styles.outcomeText}>
        {receiptState(receipt.estado)}
        {date}
      </p>
      {rejected && receipt.motivo_rechazo ? (
        <p className={styles.reason}>
          <span className={styles.reasonLabel}>Motivo: </span>
          {receipt.motivo_rechazo}
        </p>
      ) : null}
    </section>
  )
}

// Receipt review (Figma 38:1129, UH19, CU-17): the dealer's data, the file, and approve or reject with a reason.
// A decided receipt opens read-only.
export default function ReceiptReviewPage() {
  const params = useParams()
  const id = Number(params.id)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string>()
  const [submitting, setSubmitting] = useState<Decision | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const messageRef = useRef<HTMLParagraphElement>(null)
  const [shownId, setShownId] = useState(id)

  // Another receipt on the same mounted page (the route param changed): start over, so nothing of the
  // previous receipt (data, reason, outcome) is shown or acted upon while the new one loads.
  if (shownId !== id) {
    setShownId(id)
    setLoadState('loading')
    setReason('')
    setReasonError(undefined)
    setSubmitting(null)
    setResult(null)
    setFailure(null)
  }

  // `isCancelled` lets the effect drop the answer of a page that is gone.
  const load = useCallback(
    (isCancelled: () => boolean = () => false) => {
      fetchReceipt(id)
        .then((receipt) => {
          if (!isCancelled()) setLoadState({ receipt })
        })
        .catch((error: unknown) => {
          if (isCancelled()) return
          if (error instanceof HttpError && error.status === 404) setLoadState('missing')
          else setLoadState({ error: error instanceof NetworkError ? 'network' : 'server' })
        })
    },
    [id],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  // The current route id, for answers that arrive after the page moved to another receipt.
  const currentId = useRef(id)
  useEffect(() => {
    currentId.current = id
  }, [id])

  // The outcome takes the focus, so it is announced and the hidden buttons do not leave the focus behind.
  useEffect(() => {
    if (result || failure) messageRef.current?.focus()
  }, [result, failure])

  const retry = () => {
    setLoadState('loading')
    load()
  }

  // Decisions act on the receipt on screen, never on an id read elsewhere.
  const decide = async (receiptId: number, decision: Decision) => {
    setResult(null)
    setFailure(null)
    if (decision === 'reject') {
      const error = validateRejectReason(reason)
      setReasonError(error)
      if (error) return
    }

    setSubmitting(decision)
    const routeId = id
    const stale = () => currentId.current !== routeId
    try {
      const receipt = decision === 'approve' ? await approveReceipt(receiptId) : await rejectReceipt(receiptId, reason.trim())
      if (stale()) return
      setLoadState({ receipt })
      setResult(RESULT[decision])
    } catch (error) {
      if (stale()) return
      if (error instanceof HttpError && error.status === 409) {
        // Someone else decided it meanwhile: show the receipt as it is now.
        setFailure((error.body as { message?: string } | undefined)?.message ?? ALREADY_REVIEWED)
        load()
      } else if (error instanceof HttpError && error.status === 422 && decision === 'reject') {
        setReasonError((error.body as ValidationBody | undefined)?.errors?.motivo_rechazo?.[0] ?? SAVE_ERROR)
      } else {
        setFailure(SAVE_ERROR)
      }
    } finally {
      if (!stale()) setSubmitting(null)
    }
  }

  if (loadState === 'loading') return <SessionLoading />
  if (loadState === 'missing') {
    return (
      <div className={styles.missing}>
        <p role="alert" className={alertStyles.alert}>
          No encontramos el comprobante.
        </p>
        <BackLink />
      </div>
    )
  }
  if ('error' in loadState) return <ErrorState kind={loadState.error} onRetry={retry} />

  const { receipt } = loadState
  const dealer = receipt.concesionaria
  const pending = receipt.estado === PENDING
  const contact = [dealer.contacto.email, dealer.contacto.telefono].filter(Boolean).join(' · ')
  const place = dealerLocation(dealer)
  const tipo = receipt.tipo === 'renovacion' ? 'Renovación' : 'Alta'

  return (
    <div className={screenStyles.page}>
      <div className={styles.header}>
        <BackLink />
        <p className={screenStyles.eyebrow}>CONCESIONARIAS</p>
        <h1 className={screenStyles.title}>Revisar comprobante</h1>
        <p className={styles.subtitle}>Revisión del registro seleccionado.</p>
      </div>
      {result ? (
        <p ref={messageRef} tabIndex={-1} role="status" className={`${alertStyles.notice} ${styles.message}`}>
          {result}
        </p>
      ) : null}
      {failure ? (
        <p ref={messageRef} tabIndex={-1} role="alert" className={`${alertStyles.alert} ${styles.message}`}>
          {failure}
        </p>
      ) : null}
      {pending ? null : <OutcomeBanner receipt={receipt} />}
      <div className={styles.layout}>
        <div className={styles.column}>
          <InfoCard id="receipt-dealer" title="Concesionaria">
            <p className={styles.cardText}>{place ? `${dealer.nombre} · ${place}` : dealer.nombre}</p>
          </InfoCard>
          <InfoCard id="receipt-contact" title="Contacto">
            <p className={styles.cardText}>{contact || 'Sin datos de contacto'}</p>
          </InfoCard>
          <InfoCard id="receipt-dealer-state" title="Estado de la concesionaria">
            <p className={styles.cardText}>{dealerState(dealer.estado_alta).label}</p>
          </InfoCard>
          <InfoCard id="receipt-state" title="Estado del comprobante">
            <p className={styles.receiptState} data-tone={receiptTone(receipt.estado)}>
              {receiptState(receipt.estado)}
            </p>
          </InfoCard>
          <InfoCard id="receipt-period" title="Período">
            <p className={styles.cardText}>
              {tipo} · {formatDay(receipt.periodo_desde)} al {formatDay(receipt.periodo_hasta)}
            </p>
          </InfoCard>
        </div>
        <ReceiptPreview receiptId={receipt.id} fileName={receipt.nombre_archivo} />
        <div className={styles.column}>
          {pending ? (
            <>
              <Field id="receipt-reason" label={REASON_LABEL} errors={reasonError ? [reasonError] : undefined}>
                {(control) => (
                  <textarea
                    {...control}
                    className={`${control.className} ${fieldStyles.textarea}`}
                    name="motivo_rechazo"
                    rows={3}
                    value={reason}
                    disabled={submitting !== null}
                    onChange={(event) => {
                      setReason(event.target.value)
                      setReasonError(undefined)
                    }}
                  />
                )}
              </Field>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.success}`}
                disabled={submitting !== null}
                aria-busy={submitting === 'approve'}
                onClick={() => void decide(receipt.id, 'approve')}
              >
                APROBAR COMPROBANTE
              </button>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.danger}`}
                disabled={submitting !== null}
                aria-busy={submitting === 'reject'}
                onClick={() => void decide(receipt.id, 'reject')}
              >
                RECHAZAR COMPROBANTE
              </button>
            </>
          ) : null}
          <Link to="/admin/concesionarias" className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
            VOLVER A CONCESIONARIAS
          </Link>
        </div>
      </div>
    </div>
  )
}
