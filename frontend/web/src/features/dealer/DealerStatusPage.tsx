import { useEffect, useState } from 'react'
import alertStyles from '../../components/alert.module.css'
import { formatDay, retentionReached } from '../admin/format'
import { DEALER_STATE_ACTIVE } from '../auth/roles'
import { useAuth } from '../auth/session/useAuth'
import { fetchSubscription } from '../subscription/api'
import type { VigenciaSuscripcion } from '../subscription/types'
import { accountStatusText } from './accountStatus'
import styles from './DealerStatusPage.module.css'

type Status = { text: string; detail?: string; tone?: 'warning' | 'error' }

// An expired subscription is not an active account (UH-20): the dates of the validity say what the dealer reads.
function subscriptionStatus(validity: VigenciaSuscripcion): Status | null {
  if (validity.estado === 'activa' && validity.vigente_hasta) {
    return { text: `Activa · vigente hasta el ${formatDay(validity.vigente_hasta)}` }
  }
  if (validity.estado === 'gracia' && validity.gracia_hasta) {
    return { text: `Activa · en período de gracia hasta el ${formatDay(validity.gracia_hasta)}`, tone: 'warning' }
  }
  if (validity.estado === 'inactiva') {
    return {
      text: 'Inactiva · suscripción vencida',
      detail: retentionDetail(validity.retencion_hasta),
      tone: 'error',
    }
  }
  return null
}

function retentionDetail(retencionHasta: string | null | undefined): string | undefined {
  if (!retencionHasta) return undefined
  return retentionReached(retencionHasta)
    ? 'Tus vehículos se eliminaron al terminar el período de retención.'
    : `Tus vehículos se conservan hasta el ${formatDay(retencionHasta)}; después se eliminan definitivamente.`
}

// Reads the subscription of an active dealer only; any failure leaves the text of the session.
function useSubscriptionStatus(active: boolean): { loading: boolean; status: Status | null } {
  const [result, setResult] = useState<{ loading: boolean; status: Status | null }>({ loading: active, status: null })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    fetchSubscription()
      .then((data) => !cancelled && setResult({ loading: false, status: subscriptionStatus(data.suscripcion) }))
      .catch(() => !cancelled && setResult({ loading: false, status: null }))
    return () => {
      cancelled = true
    }
  }, [active])

  return result
}

// Dealer landing screen (Figma 38:860), reduced to UH17: the state of the adhesion request.
// The receipt review card and the inventory button arrive with their own stories.
export default function DealerStatusPage() {
  const { user } = useAuth()
  const estadoAlta = user?.concesionaria?.estado_alta
  const { loading, status } = useSubscriptionStatus(estadoAlta === DEALER_STATE_ACTIVE)
  const toneClass = status?.tone === 'error' ? alertStyles.alert : status?.tone === 'warning' ? alertStyles.warning : styles.status

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Verificación de suscripción</h1>
        <p className={styles.subtitle}>Estado de tu solicitud de adhesión.</p>
      </div>
      <section className={styles.card} aria-labelledby="dealer-status-title">
        <h2 id="dealer-status-title" className={styles.cardTitle}>
          Estado de la cuenta
        </h2>
        {loading ? (
          <p role="status" className={styles.loading}>
            <span aria-hidden="true" className={styles.spinner} />
            Cargando…
          </p>
        ) : status ? (
          <>
            <p className={toneClass} data-tone={status.tone}>
              {status.text}
            </p>
            {status.detail ? <p className={styles.status}>{status.detail}</p> : null}
          </>
        ) : (
          <p className={styles.status}>{accountStatusText(estadoAlta)}</p>
        )}
      </section>
    </div>
  )
}
