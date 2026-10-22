import type { ChangeEvent, FormEvent } from 'react'
import type { FieldErrors } from '../types'
import alertStyles from '../../../components/alert.module.css'
import buttonStyles from '../../../components/button.module.css'
import Field from '../shared/Field'
import PasswordInput from '../shared/PasswordInput'
import PasswordRequirements from '../shared/PasswordRequirements'
import styles from '../shared/authForm.module.css'

export type ResetPasswordValues = {
  password: string
  passwordConfirmation: string
}

type Props = {
  values: ResetPasswordValues
  errors: FieldErrors
  submitting: boolean
  formError?: string
  onChange: (field: keyof ResetPasswordValues, value: string) => void
  onSubmit: () => void
}

export default function ResetPasswordForm({ values, errors, submitting, formError, onChange, onSubmit }: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  const handleChange = (field: keyof ResetPasswordValues) => (event: ChangeEvent<HTMLInputElement>) =>
    onChange(field, event.target.value)

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      {formError ? (
        <p role="alert" className={alertStyles.alert}>
          {formError}
        </p>
      ) : null}
      <div className={styles.fields}>
        <Field
          id="reset-password"
          label="Nueva contraseña"
          errors={errors.password}
          hint={<PasswordRequirements id="reset-password-hint" password={values.password} />}
        >
          {(control) => (
            <PasswordInput
              {...control}
              name="password"
              autoComplete="new-password"
              value={values.password}
              onChange={handleChange('password')}
            />
          )}
        </Field>
        <Field id="reset-passwordConfirmation" label="Confirmar contraseña" errors={errors.passwordConfirmation}>
          {(control) => (
            <PasswordInput
              {...control}
              name="passwordConfirmation"
              autoComplete="new-password"
              value={values.passwordConfirmation}
              onChange={handleChange('passwordConfirmation')}
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
        {submitting ? 'GUARDANDO…' : 'GUARDAR CONTRASEÑA'}
      </button>
    </form>
  )
}
