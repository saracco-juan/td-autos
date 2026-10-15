import { Link } from 'react-router'
import buttonStyles from '../../components/button.module.css'
import { formatSentDate } from '../subscription/format'
import adminStyles from './admin.module.css'
import styles from './DealerEditPage.module.css'
import { dealerState, formatDay, receiptState, receiptTone } from './format'
import type { DealerDetail, DealerReceiptRow } from './types'

const PENDING = 'pendiente de revisión'

function SubscriptionCard({ dealer }: { dealer: DealerDetail }) {
  const { suscripcion } = dealer

  return (
    <section className={adminStyles.card} aria-labelledby="dealer-subscription">
      <h2 id="dealer-subscription" className={adminStyles.cardTitle}>
        Suscripción
      </h2>
      <dl className={styles.facts}>
        <dt>Estado de la concesionaria</dt>
        <dd>{dealerState(dealer.estado_alta).label}</dd>
        {suscripcion ? (
          <>
            <dt>Estado de la suscripción</dt>
            <dd>{dealerState(suscripcion.estado).label}</dd>
          </>
        ) : null}
      </dl>
      {suscripcion === null ? (
        <p className={adminStyles.cardBody}>Todavía no tiene una suscripción.</p>
      ) : (
        <>
          <p className={adminStyles.cardBody}>
            {suscripcion.vigente_desde && suscripcion.vigente_hasta
              ? `Vigente desde ${formatDay(suscripcion.vigente_desde)} hasta ${formatDay(suscripcion.vigente_hasta)}`
              : 'Todavía no tiene vigencia.'}
          </p>
          {suscripcion.gracia_hasta ? (
            <p className={adminStyles.cardBody}>{`Gracia hasta el ${formatDay(suscripcion.gracia_hasta)}`}</p>
          ) : null}
          {suscripcion.retencion_hasta ? (
            <p className={adminStyles.cardBody}>{`Vehículos conservados hasta el ${formatDay(suscripcion.retencion_hasta)}`}</p>
          ) : null}
        </>
      )}
    </section>
  )
}

function ReceiptItem({ receipt }: { receipt: DealerReceiptRow }) {
  const pending = receipt.estado === PENDING

  return (
    <li className={styles.receipt}>
      <div className={styles.receiptInfo}>
        <span className={styles.receiptTitle}>{receipt.tipo === 'renovacion' ? 'Renovación' : 'Alta'}</span>
        <span>
          {formatDay(receipt.periodo_desde)} al {formatDay(receipt.periodo_hasta)}
        </span>
        {receipt.enviado_en ? <span className={adminStyles.cardBody}>Enviado el {formatSentDate(receipt.enviado_en)}</span> : null}
        <span className={styles.receiptState} data-tone={receiptTone(receipt.estado)}>
          {receiptState(receipt.estado)}
        </span>
        {receipt.estado === 'rechazado' && receipt.motivo_rechazo ? (
          <span className={styles.reason}>
            <span className={styles.reasonLabel}>Motivo: </span>
            {receipt.motivo_rechazo}
          </span>
        ) : null}
      </div>
      <Link
        to={`/admin/comprobantes/${receipt.id}`}
        className={`${buttonStyles.button} ${pending ? buttonStyles.primary : buttonStyles.secondary} ${styles.receiptLink}`}
      >
        {pending ? 'REVISAR' : 'VER'}
      </Link>
    </li>
  )
}

function ReceiptHistory({ receipts }: { receipts: DealerReceiptRow[] }) {
  return (
    <section className={adminStyles.card} aria-labelledby="dealer-receipts">
      <h2 id="dealer-receipts" className={adminStyles.cardTitle}>
        Comprobantes
      </h2>
      {receipts.length === 0 ? (
        <p className={adminStyles.cardBody}>Todavía no envió comprobantes.</p>
      ) : (
        <ul className={styles.list}>
          {receipts.map((receipt) => (
            <ReceiptItem key={receipt.id} receipt={receipt} />
          ))}
        </ul>
      )}
    </section>
  )
}

// Read-only part of the dealer page (D1): subscription state and validity, and the receipts newest first.
// Changing the state happens only by approving or rejecting a receipt (CU-17).
export default function DealerOverview({ dealer }: { dealer: DealerDetail }) {
  return (
    <div className={styles.info}>
      <SubscriptionCard dealer={dealer} />
      <ReceiptHistory receipts={dealer.comprobantes} />
    </div>
  )
}
