import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import screenStyles from '../../components/screen.module.css'
import { NetworkError } from '../../lib/http'
import { DEALER_STATE_ACTIVE } from '../auth/roles'
import SessionLoading from '../auth/session/SessionLoading'
import { formatDay } from '../admin/format'
import { accountStatusText } from '../dealer/accountStatus'
import { INVENTORY_PATH } from '../inventory/inventoryRoutes'
import { fetchSubscription, sendReceipt } from './api'
import { formatMonthlyAmount, formatSentDate } from './format'
import { RECEIPT_ACCEPT, sendErrorMessage, validateReceipt } from './receipt'
import styles from './SubscriptionPage.module.css'
import type { DatosTransferencia, Suscripcion, UltimoComprobante, VigenciaSuscripcion } from './types'

function reviewText(pending: boolean, rejected: boolean): string {
  if (pending) return 'Tu comprobante está en revisión.'
  if (rejected) return 'Tu comprobante fue rechazado. Podés enviar uno nuevo.'
  return 'La administración aprueba o rechaza el comprobante.'
}

type LoadState = 'loading' | { ready: Suscripcion } | { error: ErrorKind }
type Message = { kind: 'error' | 'success'; text: string }

const NO_TRANSFER_DATA = 'Los datos de transferencia no están disponibles por el momento. Probá más tarde.'

function Card({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <h2 id={titleId} className={styles.cardTitle}>
        {title}
      </h2>
      {children}
    </section>
  )
}

const Body = ({ children, accent }: { children: ReactNode; accent?: boolean }) => (
  <p className={accent ? `${styles.cardBody} ${styles.status}` : styles.cardBody}>{children}</p>
)

function TransferData({ data, kind }: { data: DatosTransferencia | null; kind: string }) {
  if (!data) return <p className={alertStyles.warning}>{NO_TRANSFER_DATA}</p>
  const rows: [string, string][] = [
    ['Titular', data.titular],
    ['CUIT', data.cuit],
    ['Banco', data.banco],
    ['CBU', data.cbu],
    ['Alias', data.alias],
    ['Monto mensual', formatMonthlyAmount(data.monto_mensual)],
  ]
  return (
    <>
      <p className={styles.kind}>{kind}</p>
      <dl className={styles.data}>
        {rows.map(([term, value]) => (
          <div key={term} className={styles.dataRow}>
            <dt className={styles.term}>{term}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

// Not in Figma: the subscription expired. Grace keeps full access until the deadline; inactive hides the vehicles for 30 days.
function ValidityNotice({ validity }: { validity: VigenciaSuscripcion }) {
  if (validity.estado === 'gracia' && validity.vigente_hasta && validity.gracia_hasta) {
    return (
      <p role="status" className={alertStyles.warning}>
        {`Tu suscripción venció el ${formatDay(validity.vigente_hasta)}. Tenés hasta el ${formatDay(validity.gracia_hasta)} para que se apruebe la renovación; después tus vehículos dejan de publicarse.`}
      </p>
    )
  }
  if (validity.estado === 'inactiva' && validity.retencion_hasta) {
    return (
      <p role="alert" className={alertStyles.alert}>
        {`Tu suscripción está inactiva y tus vehículos no se publican. Los conservamos hasta el ${formatDay(validity.retencion_hasta)}: subí el comprobante de renovación para recuperarlos.`}
      </p>
    )
  }
  return null
}

// Not in Figma: the latest receipt was rejected. The reason tells the dealer what to fix before sending a new one.
function RejectedNotice({ receipt }: { receipt: UltimoComprobante }) {
  const titleId = useId()
  const date = receipt.fecha_revision ? ` el ${formatSentDate(receipt.fecha_revision)}` : ''
  return (
    <section aria-labelledby={titleId} className={`${alertStyles.alert} ${styles.rejected}`}>
      <h2 id={titleId} className={styles.rejectedTitle}>
        Tu comprobante fue rechazado
      </h2>
      <p className={styles.rejectedText}>{`Lo rechazamos${date}. Enviá uno nuevo para continuar.`}</p>
      {receipt.motivo_rechazo ? (
        <p className={styles.rejectedText}>
          <span className={styles.rejectedLabel}>Motivo: </span>
          <span>{receipt.motivo_rechazo}</span>
        </p>
      ) : null}
    </section>
  )
}

// Dealer subscription screen (Figma 38:826, UH-18): transfer data, the receipt picker and the review state.
export default function SubscriptionPage() {
  const [load, setLoad] = useState<LoadState>('loading')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const messageRef = useRef<HTMLParagraphElement>(null)

  // `isCancelled` lets the effect drop the answer of a page that is gone.
  const loadSummary = useCallback((isCancelled: () => boolean = () => false) => {
    fetchSubscription()
      .then((summary) => {
        if (!isCancelled()) setLoad({ ready: summary })
      })
      .catch((error: unknown) => {
        if (!isCancelled()) setLoad({ error: error instanceof NetworkError ? 'network' : 'server' })
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSummary(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadSummary])

  // The result takes the focus once it is on screen, so it is announced.
  useEffect(() => {
    if (message) messageRef.current?.focus()
  }, [message])

  const retry = () => {
    setLoad('loading')
    loadSummary()
  }

  const handleSend = async () => {
    const invalid = validateReceipt(file)
    if (invalid || !file) {
      setMessage({ kind: 'error', text: invalid ?? '' })
      return
    }
    setMessage(null)
    setSubmitting(true)
    try {
      const updated = await sendReceipt(file)
      setLoad({ ready: updated })
      setFile(null)
      setMessage({ kind: 'success', text: 'Enviaste el comprobante. Queda pendiente de revisión.' })
    } catch (error) {
      // The selected file stays so the dealer can try again.
      setMessage({ kind: 'error', text: sendErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  // The loader and the error are direct children of the content area so they are centered there.
  if (load === 'loading') return <SessionLoading />
  if ('error' in load) return <ErrorState kind={load.error} onRetry={retry} />

  const summary = load.ready
  const validity = summary.suscripcion
  const receipt = summary.comprobante_pendiente
  const rejected = !receipt && summary.ultimo_comprobante?.estado === 'rechazado' ? summary.ultimo_comprobante : null
  const kind = summary.tipo_pago === 'alta' ? 'Pago de alta inicial' : 'Renovación mensual'
  const receiptText = receipt
    ? `${receipt.nombre_archivo} · enviado el ${formatSentDate(receipt.enviado_en)}`
    : (file?.name ?? 'Todavía no seleccionaste un comprobante.')

  return (
    <div className={screenStyles.page}>
      <div className={styles.header}>
        <p className={screenStyles.eyebrow}>SUSCRIPCIÓN</p>
        <h1 className={screenStyles.title}>Suscripción y comprobantes</h1>
        <p className={styles.subtitle}>Transferencia bancaria para el alta inicial y la renovación mensual.</p>
      </div>
      <ValidityNotice validity={validity} />
      {rejected ? <RejectedNotice receipt={rejected} /> : null}
      <div className={styles.cards}>
        <Card title="Estado de la cuenta">
          <Body accent>{accountStatusText(summary.estado_alta)}</Body>
          {validity.estado === 'activa' && validity.vigente_hasta ? (
            <Body>{`Suscripción vigente hasta el ${formatDay(validity.vigente_hasta)}`}</Body>
          ) : null}
        </Card>
        <Card title="Comprobante">
          <Body>{receiptText}</Body>
        </Card>
        <Card title="Revisión">
          <Body>{reviewText(Boolean(receipt), rejected !== null)}</Body>
        </Card>
      </div>
      <Card title="Datos para la transferencia">
        <TransferData data={summary.transferencia} kind={kind} />
      </Card>
      <Card title="Renovación y recuperación">
        <Body>
          Tras vencer el pago: 3 días plenamente operativos; después, inventario oculto durante 30 días. Al aprobar dentro de la
          retención se reactiva automáticamente.
        </Body>
      </Card>
      {message ? (
        <p
          ref={messageRef}
          tabIndex={-1}
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`${message.kind === 'error' ? alertStyles.alert : alertStyles.notice} ${styles.message}`}
        >
          {message.text}
        </p>
      ) : null}
      <div className={styles.actions}>
        {receipt ? null : (
          <>
            <label className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.pick}`}>
              SELECCIONAR COMPROBANTE
              <input
                type="file"
                accept={RECEIPT_ACCEPT}
                className={styles.fileInput}
                disabled={submitting}
                onChange={(event) => {
                  const picked = event.target.files?.[0]
                  // The same file can be picked again after a failure.
                  event.target.value = ''
                  if (!picked) return
                  setFile(picked)
                  setMessage(null)
                }}
              />
            </label>
            <button
              type="button"
              className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.send}`}
              disabled={submitting || !summary.transferencia}
              aria-busy={submitting}
              onClick={() => void handleSend()}
            >
              ENVIAR COMPROBANTE
            </button>
          </>
        )}
        {summary.estado_alta === DEALER_STATE_ACTIVE && validity.estado !== 'inactiva' ? (
          <Link to={INVENTORY_PATH} className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.inventory}`}>
            VER INVENTARIO
          </Link>
        ) : null}
      </div>
    </div>
  )
}
