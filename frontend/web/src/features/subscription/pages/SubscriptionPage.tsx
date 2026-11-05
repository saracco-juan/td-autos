import Button from '../../../components/Buttons/Button'
import ButtonLink from '../../../components/Buttons/ButtonLink'
import Dialog from '../../../components/Dialog/Dialog'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import alertStyles from '../../../styles/alert.module.css'
import buttonStyles from '../../../components/Buttons/button.module.css'
import ErrorState, { type ErrorKind } from '../../../components/ErrorState/ErrorState'
import FlowLayout from '../../../components/FlowLayout/FlowLayout'
import screenStyles from '../../../styles/screen.module.css'
import { NetworkError } from '../../../lib/http'
import { DEALER_STATE_ACTIVE } from '../../auth/model/roles'
import SessionLoading from '../../auth/session/components/SessionLoading'
import { formatDay, retentionReached } from '../../admin/model/format'
import { accountStatusText } from '../../dealer/model/accountStatus'
import { INVENTORY_PATH } from '../../inventory/model/inventoryRoutes'
import { fetchSubscription, sendReceipt } from '../api/client'
import ReceiptHistory from '../components/ReceiptHistory'
import { formatMonthlyAmount, formatSentDate } from '../model/format'
import { RECEIPT_ACCEPT, sendErrorMessage, validateReceipt } from '../model/receipt'
import styles from './SubscriptionPage.module.css'
import type { DatosTransferencia, Suscripcion, UltimoComprobante, VigenciaSuscripcion } from '../model/types'

type LoadState = 'loading' | { ready: Suscripcion } | { error: ErrorKind }
type Message = { kind: 'error' | 'success'; text: string }

const NO_TRANSFER_DATA = 'Los datos para pagar todavía no están configurados. Contactá a la administración para que los complete; hasta entonces no podés enviar un comprobante.'

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

const Body = ({ children, accent, success }: { children: ReactNode; accent?: boolean; success?: boolean }) => (
  <p className={[styles.cardBody, success ? styles.activeStatus : accent && styles.status].filter(Boolean).join(' ')}>{children}</p>
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
    const text = retentionReached(validity.retencion_hasta)
      ? 'Tu suscripción está inactiva y tus vehículos se eliminaron porque pasaron 30 días sin renovación. Subí el comprobante de renovación para volver a gestionar tu inventario.'
      : `Tu suscripción está inactiva y tus vehículos no se publican. Los conservamos hasta el ${formatDay(validity.retencion_hasta)}; después se eliminan definitivamente. Subí el comprobante de renovación para recuperarlos.`
    return (
      <p role="alert" className={alertStyles.alert}>
        {text}
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
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [animatePayment, setAnimatePayment] = useState(true)
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

  const showSend = !receipt
  const showInventory = summary.estado_alta === DEALER_STATE_ACTIVE && validity.estado !== 'inactiva'
  const actions =
    showSend ? (
      <div className={styles.actions}>
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
        <Button
          type="button"
          variant="primary" className={styles.send}
          disabled={submitting || !summary.transferencia}
          aria-busy={submitting}
          onClick={() => void handleSend()}
        >
          ENVIAR COMPROBANTE
        </Button>
      </div>
    ) : null

  return (
    <FlowLayout actions={null}>
      <div className={styles.header}>
        <div>
          <h1 className={screenStyles.title}>Suscripción y comprobantes</h1>
          <p className={styles.subtitle}>Transferencia bancaria para el alta inicial y la renovación mensual.</p>
        </div>
        <div className={styles.headerActions}>
          {showInventory ? <ButtonLink to={INVENTORY_PATH} variant="secondary" className={styles.inventory}>VER INVENTARIO</ButtonLink> : null}
          <Button type="button" className={styles.send} disabled={Boolean(receipt)}
            onClick={(event) => { setAnimatePayment(event.detail > 0); setPaymentOpen(true) }}>
            REALIZAR TRANSFERENCIA
          </Button>
        </div>
      </div>
      <ValidityNotice validity={validity} />
      {rejected ? <RejectedNotice receipt={rejected} /> : null}
      <div className={styles.cards}>
        <Card title="Estado de la cuenta">
          <div className={styles.accountSummary}>
            {summary.transferencia ? <p className={styles.amount}>{formatMonthlyAmount(summary.transferencia.monto_mensual)}<span> / mes</span></p> : null}
            <Body accent success={summary.estado_alta === DEALER_STATE_ACTIVE && validity.estado !== 'inactiva'}>
              {validity.estado === 'inactiva' ? 'Inactiva · suscripción vencida' : accountStatusText(summary.estado_alta)}
            </Body>
          </div>
          {validity.estado === 'activa' && validity.vigente_hasta ? (
            <Body>{`Suscripción vigente hasta el ${formatDay(validity.vigente_hasta)}`}</Body>
          ) : null}
        </Card>
      </div>
      <ReceiptHistory revision={summary.comprobante_pendiente?.id ?? summary.ultimo_comprobante?.id ?? null} />
      <Dialog open={paymentOpen} title="Realizar transferencia" busy={submitting} animate={animatePayment}
        onClose={() => setPaymentOpen(false)}>
        <p className={styles.modalHint}>Podés renovar antes del vencimiento. La administración revisa el comprobante antes de aplicar el nuevo período.</p>
        <div className={styles.payment}>
          <section aria-labelledby="transfer-heading" className={styles.transfer}>
            <h2 id="transfer-heading" className={styles.cardTitle}>Datos para la transferencia</h2>
            <TransferData data={summary.transferencia} kind={kind} />
          </section>
          <section aria-labelledby="upload-heading" className={styles.upload}>
            <h2 id="upload-heading" className={styles.cardTitle}>Adjuntar comprobante</h2>
            <Body>{receiptText}</Body>
            <Body>Adjuntá el comprobante de tu transferencia en PDF, JPG o PNG, de hasta 5 MB.</Body>
            {actions}
            {!summary.transferencia && !receipt ? <Body>El envío se habilita cuando la administración completa los datos para pagar.</Body> : null}
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
          </section>
        </div>
        <section aria-labelledby="renewal-heading" className={styles.renewal}>
          <h2 id="renewal-heading" className={styles.cardTitle}>Renovación y recuperación</h2>
          <Body>
            Tras vencer el pago: 3 días plenamente operativos; después, inventario oculto durante 30 días. Al aprobar la renovación
            dentro de la retención, tus vehículos se publican de nuevo automáticamente; pasados los 30 días se eliminan definitivamente.
          </Body>
        </section>
      </Dialog>
    </FlowLayout>
  )
}
