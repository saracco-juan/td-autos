import type { ChangeEvent, FormEvent } from 'react'
import type { FieldErrors } from '../types'
import alertStyles from '../../../components/alert.module.css'
import buttonStyles from '../../../components/button.module.css'
import Field from '../shared/Field'
import PasswordInput from '../shared/PasswordInput'
import styles from '../shared/authForm.module.css'
import type { LoginFormValues } from './validateLoginForm'

type Props = {
  values: LoginFormValues
  errors: FieldErrors
  submitting: boolean
  formError?: string
  onChange: (field: keyof LoginFormValues, value: string) => void
  onSubmit: () => void
}

export default function LoginForm({ values, errors, submitting, formError, onChange, onSubmit }: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  const handleChange = (field: keyof LoginFormValues) => (event: ChangeEvent<HTMLInputElement>) =>
    onChange(field, event.target.value)

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      {formError ? (
        <p role="alert" className={alertStyles.alert}>
          {formError}
        </p>
      ) : null}
      <div className={styles.fields}>
        <Field id="login-email" label="Email" errors={errors.email}>
          {(control) => (
            <input
              {...control}
              type="email"
              name="email"
              autoComplete="email"
              value={values.email}
              onChange={handleChange('email')}
            />
          )}
        </Field>
        <Field id="login-password" label="Contraseña" errors={errors.password}>
          {(control) => (
            <PasswordInput
              {...control}
              name="password"
              autoComplete="current-password"
              value={values.password}
              onChange={handleChange('password')}
            />
          )}
        </Field>
      </div>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={`${buttonStyles.button} ${buttonStyles.primary}`}
      >
        {submitting ? 'INGRESANDO…' : 'INGRESAR'}
      </button>
    </form>
  )
}
