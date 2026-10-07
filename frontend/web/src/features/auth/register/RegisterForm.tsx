import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import type { FieldErrors, FieldName } from '../types'
import alertStyles from '../../../components/alert.module.css'
import buttonStyles from '../../../components/button.module.css'
import Field from '../shared/Field'
import PasswordInput from '../shared/PasswordInput'
import PasswordRequirements from '../shared/PasswordRequirements'
import styles from '../shared/authForm.module.css'
import type { RegisterFormValues } from './validateRegisterForm'

type Props = {
  values: RegisterFormValues
  errors: FieldErrors
  submitting: boolean
  formError?: string
  onChange: (field: keyof RegisterFormValues, value: string) => void
  onSubmit: () => void
}

type RegisterFieldProps = {
  field: FieldName
  label: string
  type?: 'text' | 'email' | 'password'
  autoComplete: string
  values: RegisterFormValues
  errors: FieldErrors
  onChange: Props['onChange']
  hint?: ReactNode
}

function RegisterField({ field, label, type = 'text', autoComplete, values, errors, onChange, hint }: RegisterFieldProps) {
  const Input = type === 'password' ? PasswordInput : 'input'

  return (
    <Field id={`register-${field}`} label={label} errors={errors[field]} hint={hint}>
      {(control) => (
        <Input
          {...control}
          name={field}
          autoComplete={autoComplete}
          value={values[field]}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value)}
          {...(type === 'password' ? {} : { type })}
        />
      )}
    </Field>
  )
}

export default function RegisterForm({ values, errors, submitting, formError, onChange, onSubmit }: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  const shared = { values, errors, onChange }

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      {formError ? (
        <p role="alert" className={alertStyles.alert}>
          {formError}
        </p>
      ) : null}
      <div className={styles.fields}>
        <RegisterField {...shared} field="name" label="Nombre completo" autoComplete="name" />
        <RegisterField {...shared} field="email" label="Email" type="email" autoComplete="email" />
        <RegisterField
          {...shared}
          field="password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          hint={<PasswordRequirements id="register-password-hint" password={values.password} />}
        />
        <RegisterField
          {...shared}
          field="passwordConfirmation"
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={`${buttonStyles.button} ${buttonStyles.primary}`}
      >
        {submitting ? 'CREANDO CUENTA…' : 'CREAR CUENTA'}
      </button>
    </form>
  )
}
