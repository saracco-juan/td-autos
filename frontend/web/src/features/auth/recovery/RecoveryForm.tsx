import type { ChangeEvent, FormEvent } from 'react'
import type { FieldErrors } from '../types'
import alertStyles from '../../../components/alert.module.css'
import buttonStyles from '../../../components/button.module.css'
import Field from '../shared/Field'
import styles from '../shared/authForm.module.css'

type Props = {
  email: string
  errors: FieldErrors
  submitting: boolean
  formError?: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export default function RecoveryForm({ email, errors, submitting, formError, onChange, onSubmit }: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      {formError ? (
        <p role="alert" className={alertStyles.alert}>
          {formError}
        </p>
      ) : null}
      <Field id="recovery-email" label="Email" errors={errors.email}>
        {(control) => (
          <input {...control} type="email" name="email" autoComplete="email" value={email} onChange={handleChange} />
        )}
      </Field>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={`${buttonStyles.button} ${buttonStyles.primary}`}
      >
        {submitting ? 'SOLICITANDO…' : 'SOLICITAR RECUPERACIÓN'}
      </button>
    </form>
  )
}
