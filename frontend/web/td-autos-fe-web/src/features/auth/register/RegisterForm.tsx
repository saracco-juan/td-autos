import type { FormEvent, ReactNode } from 'react'
import type { FieldErrors, FieldName } from '../types'
import PasswordRequirements from './PasswordRequirements'
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
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={field}
        type={type}
        autoComplete={autoComplete}
        value={values[field]}
        aria-invalid={fieldErrors ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {fieldErrors ? (
        <ul id={errorId}>
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
    <form onSubmit={handleSubmit} noValidate>
      {formError ? <p role="alert">{formError}</p> : null}
      <Field {...shared} field="name" label="Nombre" autoComplete="given-name" />
      <Field {...shared} field="apellido" label="Apellido" autoComplete="family-name" />
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
      <button type="submit" disabled={submitting}>
        Registrarse
      </button>
    </form>
  )
}
