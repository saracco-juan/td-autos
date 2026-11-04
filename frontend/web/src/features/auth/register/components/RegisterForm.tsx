import Button from '../../../../components/Buttons/Button'
import type { FormEvent } from 'react'
import type { FieldErrors } from '../../types'
import alertStyles from '../../../../styles/alert.module.css'
import PasswordRequirements from '../../shared/components/PasswordRequirements'
import TextField, { type TextFieldProps } from '../../shared/components/TextField'
import styles from '../../shared/styles/authForm.module.css'
import type { RegisterFormValues } from '../model/validateRegisterForm'

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
      <Button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        variant="primary"
      >
        {submitting ? 'CREANDO CUENTA…' : 'CREAR CUENTA'}
      </Button>
    </form>
  )
}
