import Button from '../../../../components/Buttons/Button'
import type { ChangeEvent, FormEvent } from 'react'
import type { FieldErrors } from '../../model/types'
import alertStyles from '../../../../styles/alert.module.css'
import Field from '../../shared/components/Field'
import PasswordInput from '../../shared/components/PasswordInput'
import styles from '../../shared/styles/authForm.module.css'
import type { LoginFormValues } from '../model/validateLoginForm'

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
      <Button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        variant="primary"
      >
        {submitting ? 'INGRESANDO…' : 'INGRESAR'}
      </Button>
    </form>
  )
}
