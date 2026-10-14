import { DEALER_STATE_ACTIVE, DEALER_STATE_PENDING } from '../auth/roles'
import { useAuth } from '../auth/session/useAuth'
import styles from './DealerStatusPage.module.css'

function statusText(state: string | null | undefined): string {
  if (state === DEALER_STATE_PENDING) return 'Pendiente de aprobación inicial · inventario bloqueado'
  if (state === DEALER_STATE_ACTIVE) return 'Activa'
  return 'Sin información de estado'
}

// Dealer landing screen (Figma 38:860), reduced to UH17: the state of the adhesion request.
// The receipt review card and the inventory button arrive with their own stories.
export default function DealerStatusPage() {
  const { user } = useAuth()

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
        <p className={styles.status}>{statusText(user?.concesionaria?.estado_alta)}</p>
      </section>
    </div>
  )
}
