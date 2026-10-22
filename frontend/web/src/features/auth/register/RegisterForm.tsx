import type { FormEvent } from 'react'
import type { FieldErrors } from '../types'
import alertStyles from '../../../components/alert.module.css'
import buttonStyles from '../../../components/button.module.css'
import PasswordRequirements from '../shared/PasswordRequirements'
import TextField, { type TextFieldProps } from '../shared/TextField'
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

type RegisterFieldProps = Pick<TextFieldProps, 'label' | 'type' | 'autoComplete' | 'hint'> & {
  field: keyof RegisterFormValues
  values: RegisterFormValues
  errors: FieldErrors
  onChange: Props['onChange']
}

function RegisterField({ field, values, errors, onChange, ...textField }: RegisterFieldProps) {
  return (
    <TextField
      {...textField}
      id={`register-${field}`}
      name={field}
      value={values[field]}
      errors={errors[field]}
      onChange={(value) => onChange(field, value)}
    />
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
