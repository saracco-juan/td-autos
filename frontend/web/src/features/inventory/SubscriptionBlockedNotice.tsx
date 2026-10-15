import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import { SUBSCRIPTION_PATH, pausedInventoryText, type InactiveSubscription } from './inactiveSubscription'
import styles from './SubscriptionBlockedNotice.module.css'

const RENEW = 'RENOVAR SUSCRIPCIÓN'

// Not in Figma: the inventory refused the dealer because the subscription is inactive. Says so and leads to the renewal.
// The card replaces the content of a page that cannot load; the compact box reports a refused submit in place.
export default function SubscriptionBlockedNotice({ info, compact }: { info: InactiveSubscription; compact?: boolean }) {
  const renew = (
    <Link to={SUBSCRIPTION_PATH} className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.link}`}>
      {RENEW}
    </Link>
  )

  if (compact) {
    return (
      <div role="alert" className={`${alertStyles.alert} ${styles.compact}`}>
        <p className={styles.message}>{info.message}</p>
        {renew}
      </div>
    )
  }

  return (
    <section className={styles.card} aria-labelledby="inventory-paused-title">
      <h2 id="inventory-paused-title" className={styles.title}>
        Tu inventario está pausado
      </h2>
      <p className={styles.message}>{pausedInventoryText(info)}</p>
      <p className={styles.message}>
        Subí el comprobante de renovación: cuando se apruebe, vas a poder volver a gestionar tu inventario.
      </p>
      {renew}
    </section>
  )
}
