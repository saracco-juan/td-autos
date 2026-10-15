import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import { SUBSCRIPTION_PATH } from './inactiveSubscription'
import styles from './SubscriptionBlockedNotice.module.css'

// Not in Figma: the inventory refused the dealer because the subscription is inactive. Says so and leads to the renewal.
export default function SubscriptionBlockedNotice({ message }: { message: string }) {
  return (
    <div role="alert" className={`${alertStyles.alert} ${styles.notice}`}>
      <p className={styles.message}>{message}</p>
      <Link to={SUBSCRIPTION_PATH} className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.link}`}>
        IR A SUSCRIPCIÓN
      </Link>
    </div>
  )
}
