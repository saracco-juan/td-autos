import Button from '../../../../components/Buttons/Button'
import { useEffect, useRef, type FormEvent } from 'react'
import alertStyles from '../../../../styles/alert.module.css'
import PasswordRequirements from '../../shared/components/PasswordRequirements'
import TextField, { type TextFieldProps } from '../../shared/components/TextField'
import styles from '../../shared/styles/authForm.module.css'
import type { DealerRegisterErrors, DealerRegisterField, DealerRegisterFormValues } from '../model/validateDealerRegisterForm'
import { DEALER_REGISTRATION_STEPS } from '../model/dealerRegistrationSteps'
import wizardStyles from './DealerRegisterForm.module.css'

type Props = Readonly<{
  values: DealerRegisterFormValues
  errors: DealerRegisterErrors
  submitting: boolean
  formError?: string
  step: number
  changing: boolean
  onPrevious: (keyboard: boolean) => void
  onChange: (field: DealerRegisterField, value: string) => void
  onSubmit: (keyboard: boolean) => void
}>

type FieldConfig = Pick<TextFieldProps, 'label' | 'type' | 'autoComplete'> & { field: DealerRegisterField }

const PASSWORD_HINT_ID = 'dealer-register-password-hint'

// One field definition per payload field, reused across the wizard steps.
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

export default function DealerRegisterForm({ values, errors, submitting, formError, step, changing, onPrevious, onChange, onSubmit }: Props) {
  const activeStep = DEALER_REGISTRATION_STEPS[step]
  const lastStep = step === DEALER_REGISTRATION_STEPS.length - 1
  let submitLabel = lastStep ? 'CREAR CUENTA' : 'SIGUIENTE'
  if (submitting) submitLabel = 'CREANDO CUENTA…'
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const pendingErrorFocus = useRef(false)
  const keyboardSubmit = useRef(false)

  useEffect(() => {
    if (changing) return
    if (previousStep.current !== step) headingRef.current?.focus({ preventScroll: true })
    previousStep.current = step
  }, [step, changing])

  useEffect(() => {
    if (pendingErrorFocus.current && !submitting && !changing) {
      formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
      pendingErrorFocus.current = false
    }
  }, [errors, submitting, step, changing])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    pendingErrorFocus.current = true
    onSubmit(keyboardSubmit.current)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className={`${styles.form} ${wizardStyles.form}`}>
      {formError ? (
        <p role="alert" className={alertStyles.alert}>
          {formError}
        </p>
      ) : null}
      <section key={step} className={wizardStyles.step} aria-labelledby="dealer-step-title">
        <h2 id="dealer-step-title" ref={headingRef} tabIndex={-1}>{activeStep.heading}</h2>
        <div className={`${styles.fieldGrid} ${wizardStyles.fields}`}>
          {FIELDS.filter(({ field }) => activeStep.fields.includes(field)).map(({ field, ...textField }) => (
            <div key={field} className={field === 'email' || field === 'address' ? styles.fullRow : undefined}>
              <TextField
                {...textField}
                id={`dealer-register-${field}`}
                name={field}
                value={values[field]}
                errors={errors[field]}
                hintId={field === 'password' ? PASSWORD_HINT_ID : undefined}
                onChange={(value) => onChange(field, value)}
              />
            </div>
          ))}
          {/* Password errors replace the checklist with the unmet requirements. */}
          {!activeStep.fields.includes('password') || errors.password ? null : (
            <div className={styles.fullRow}>
              <PasswordRequirements id={PASSWORD_HINT_ID} password={values.password} />
            </div>
          )}
        </div>
      </section>
      <div className={wizardStyles.actions}>
        {step > 0 && (
          <Button type="button" variant="secondary" disabled={submitting || changing} onClick={(event) => onPrevious(event.detail === 0)}>ANTERIOR</Button>
        )}
        <Button
          type="submit"
          disabled={submitting || changing}
          aria-busy={submitting}
          variant="primary"
          className={wizardStyles.next}
          onClick={(event) => { keyboardSubmit.current = event.detail === 0 }}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
