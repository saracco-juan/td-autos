import alertStyles from '../../components/alert.module.css'
import BackLink from './BackLink'
import styles from './MissingState.module.css'

// An admin record that does not exist (404): the message and the way back to the dealer list.
export default function MissingState({ message }: { message: string }) {
  return (
    <div className={styles.missing}>
      <p role="alert" className={alertStyles.alert}>
        {message}
      </p>
      <BackLink />
    </div>
  )
}
