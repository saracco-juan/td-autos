import type { FormEvent, ReactNode } from 'react'
import type { FieldErrors, FieldName } from '../types'
import alertStyles from '../../../components/alert.module.css'
import buttonStyles from '../../../components/button.module.css'
import PasswordRequirements from './PasswordRequirements'
import styles from './RegisterForm.module.css'
import type { RegisterFormValues } from './validateRegisterForm'

type Props = {
  values: RegisterFormValues
  errors: FieldErrors
  submitting: boolean
  formError?: string
  onChange: (field: keyof RegisterFormValues, value: string) => void
  onSubmit: () => void
}

type FieldProps = {
  field: FieldName
  label: string
  type?: string
  autoComplete: string
  values: RegisterFormValues
  errors: FieldErrors
  onChange: Props['onChange']
  hint?: ReactNode
}

function Field({ field, label, type = 'text', autoComplete, values, errors, onChange, hint }: FieldProps) {
  const id = `register-${field}`
  const fieldErrors = errors[field]
  const errorId = `${id}-error`
  const describedBy = fieldErrors ? errorId : hint ? `${id}-hint` : undefined

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        name={field}
        className={styles.input}
        type={type}
        autoComplete={autoComplete}
        value={values[field]}
        aria-invalid={fieldErrors ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {fieldErrors ? (
        <ul id={errorId} className={styles.errors}>
          {fieldErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        hint
      )}
    </div>
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
        <Field {...shared} field="name" label="Nombre completo" autoComplete="name" />
        <Field {...shared} field="email" label="Email" type="email" autoComplete="email" />
        <Field
          {...shared}
          field="password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          hint={<PasswordRequirements id="register-password-hint" password={values.password} />}
        />
        <Field
          {...shared}
          field="passwordConfirmation"
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
        />
      </div>
      <button type="submit" disabled={submitting} className={`${buttonStyles.button} ${buttonStyles.primary}`}>
        CREAR CUENTA
      </button>
    </form>
  )
}
