import Button from '../../../../components/Buttons/Button'
import type { ChangeEvent, FormEvent } from 'react'
import type { FieldErrors } from '../../model/types'
import alertStyles from '../../../../styles/alert.module.css'
import Field from '../../shared/components/Field'
import styles from '../../shared/styles/authForm.module.css'

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
      <Button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        variant="primary"
      >
        {submitting ? 'SOLICITANDO…' : 'SOLICITAR RECUPERACIÓN'}
      </Button>
    </form>
  )
}
