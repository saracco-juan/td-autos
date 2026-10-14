import { useAuth } from '../auth/session/useAuth'
import { accountStatusText } from './accountStatus'
import styles from './DealerStatusPage.module.css'

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
        <p className={styles.status}>{accountStatusText(user?.concesionaria?.estado_alta)}</p>
      </section>
    </div>
  )
}
