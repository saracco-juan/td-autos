import ButtonAnchor from '../../../../components/Buttons/ButtonAnchor'
import GoogleIcon from '../../../../components/GoogleIcon/GoogleIcon'
import { GOOGLE_REDIRECT_URL } from '../../api/client'
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
      <ButtonAnchor href={`${GOOGLE_REDIRECT_URL}?from=${from}`} variant="secondary">
        <GoogleIcon />
        CONTINUAR CON GOOGLE
      </ButtonAnchor>
    </>
  )
}
