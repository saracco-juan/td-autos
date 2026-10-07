import buttonStyles from '../../../components/button.module.css'
import GoogleIcon from '../../../components/GoogleIcon'
import { GOOGLE_REDIRECT_URL } from '../api'
import styles from './GoogleAuthLink.module.css'

type GoogleOrigin = 'registro' | 'login'

// "o" divider plus the secondary Google action, shared by the register and login screens.
// `from` tells the backend which screen to return to if the Google flow fails.
export default function GoogleAuthLink({ from }: { from: GoogleOrigin }) {
  return (
    <>
      <div className={styles.divider}>
        <span>o</span>
      </div>
      <a href={`${GOOGLE_REDIRECT_URL}?from=${from}`} className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
        <GoogleIcon />
        CONTINUAR CON GOOGLE
      </a>
    </>
  )
}
