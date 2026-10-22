import { useState, type InputHTMLAttributes } from 'react'
import styles from './authForm.module.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

// Password input with an eye button that toggles between hidden and plain text.
export default function PasswordInput({ className, ...inputProps }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={styles.passwordWrapper}>
      <input {...inputProps} type={visible ? 'text' : 'password'} className={`${className ?? ''} ${styles.passwordInput}`} />
      <button
        type="button"
        className={styles.visibilityToggle}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible ? <path d="M3 3l18 18" /> : null}
        </svg>
      </button>
    </div>
  )
}
