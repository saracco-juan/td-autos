import type { FormEvent } from 'react'
import alertStyles from '../../../components/alert.module.css'
import buttonStyles from '../../../components/button.module.css'
import PasswordRequirements from '../shared/PasswordRequirements'
import TextField, { type TextFieldProps } from '../shared/TextField'
import styles from '../shared/authForm.module.css'
import type { DealerRegisterErrors, DealerRegisterField, DealerRegisterFormValues } from './validateDealerRegisterForm'

type Props = {
  values: DealerRegisterFormValues
  errors: DealerRegisterErrors
  submitting: boolean
  formError?: string
  onChange: (field: DealerRegisterField, value: string) => void
  onSubmit: () => void
}

type FieldConfig = Pick<TextFieldProps, 'label' | 'type' | 'autoComplete'> & { field: DealerRegisterField }

const PASSWORD_HINT_ID = 'dealer-register-password-hint'

// Figma 38:779, row by row: left column, then right column.
const FIELDS: FieldConfig[] = [
  { field: 'dealerName', label: 'Nombre de la concesionaria', autoComplete: 'organization' },
  { field: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { field: 'name', label: 'Nombre del responsable', autoComplete: 'given-name' },
  { field: 'lastName', label: 'Apellido del responsable', autoComplete: 'family-name' },
  { field: 'dni', label: 'DNI del responsable', autoComplete: 'off' },
  { field: 'contactPhone', label: 'Teléfono del responsable', type: 'tel', autoComplete: 'tel' },
  { field: 'publicPhone', label: 'Teléfono público', type: 'tel', autoComplete: 'off' },
  { field: 'address', label: 'Dirección', autoComplete: 'street-address' },
  { field: 'city', label: 'Localidad', autoComplete: 'address-level2' },
  { field: 'province', label: 'Provincia', autoComplete: 'address-level1' },
  { field: 'password', label: 'Contraseña', type: 'password', autoComplete: 'new-password' },
  { field: 'passwordConfirmation', label: 'Confirmar contraseña', type: 'password', autoComplete: 'new-password' },
]

export default function DealerRegisterForm({ values, errors, submitting, formError, onChange, onSubmit }: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      {formError ? (
        <p role="alert" className={alertStyles.alert}>
          {formError}
        </p>
      ) : null}
      <div className={styles.fieldGrid}>
        {FIELDS.map(({ field, ...textField }) => (
          <TextField
            key={field}
            {...textField}
            id={`dealer-register-${field}`}
            name={field}
            value={values[field]}
            errors={errors[field]}
            hintId={field === 'password' ? PASSWORD_HINT_ID : undefined}
            onChange={(value) => onChange(field, value)}
          />
        ))}
        {/* As in the buyer form, the password errors replace the checklist: they list the unmet requirements. */}
        {errors.password ? null : (
          <div className={styles.fullRow}>
            <PasswordRequirements id={PASSWORD_HINT_ID} password={values.password} />
          </div>
        )}
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
