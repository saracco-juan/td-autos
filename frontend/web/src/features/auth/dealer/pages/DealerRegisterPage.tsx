import { useState } from 'react'
import { useNavigate } from 'react-router'
import { HttpError } from '../../../../lib/http'
import { registerDealer } from '../../api/client'
import { useAuth } from '../../session/hooks/useAuth'
import type { DealerRegisterPayload } from '../../model/types'
import AuthPageHeader from '../../shared/components/AuthPageHeader'
import AuthSwitchLink from '../../shared/components/AuthSwitchLink'
import linkStyles from '../../shared/styles/authLinks.module.css'
import DealerRegisterForm from '../components/DealerRegisterForm'
import DealerRegistrationProgress from '../components/DealerRegistrationProgress'
import useDealerRegistrationStep from '../hooks/useDealerRegistrationStep'
import { DEALER_REGISTRATION_STEPS, firstInvalidDealerStep } from '../model/dealerRegistrationSteps'
import pageStyles from './DealerRegisterPage.module.css'
import {
  validateDealerRegisterForm,
  type DealerRegisterErrors,
  type DealerRegisterField,
  type DealerRegisterFormValues,
} from '../model/validateDealerRegisterForm'

const GENERIC_ERROR = 'No se pudo completar el registro. Intentá nuevamente.'

// Form field -> key of the API payload, which is also the key of its 422 errors (except the confirmation).
const SERVER_KEYS: Record<DealerRegisterField, keyof DealerRegisterPayload> = {
  dealerName: 'nombre_concesionaria',
  email: 'email',
  name: 'name',
  lastName: 'apellido',
  dni: 'responsable_dni',
  contactPhone: 'telefono_responsable',
  publicPhone: 'telefono_publico',
  address: 'direccion',
  city: 'localidad',
  province: 'provincia',
  password: 'password',
  passwordConfirmation: 'password_confirmation',
}

const FORM_FIELDS = Object.keys(SERVER_KEYS) as DealerRegisterField[]

// `password_confirmation` is only sent: the API reports a mismatch under `password` (Laravel's `confirmed` rule).
const SERVER_ERROR_FIELDS = FORM_FIELDS.filter((field) => field !== 'passwordConfirmation')

const EMPTY_VALUES = Object.fromEntries(FORM_FIELDS.map((field) => [field, ''])) as DealerRegisterFormValues

type ValidationBody = { errors?: Partial<Record<string, string[]>> }

function toPayload(values: DealerRegisterFormValues): DealerRegisterPayload {
  const entries = FORM_FIELDS.map((field) => {
    const isPassword = field === 'password' || field === 'passwordConfirmation'
    return [SERVER_KEYS[field], isPassword ? values[field] : values[field].trim()]
  })
  return Object.fromEntries(entries) as DealerRegisterPayload
}

function fieldErrorsFromServer(body: ValidationBody | undefined): DealerRegisterErrors {
  const errors: DealerRegisterErrors = {}
  for (const field of SERVER_ERROR_FIELDS) {
    const messages = body?.errors?.[SERVER_KEYS[field]]
    if (messages && messages.length > 0) errors[field] = messages
  }
  return errors
}

// Dealer self-registration (UH17, RF15): creates the responsible person's account and a pending dealer.
export default function DealerRegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState<DealerRegisterErrors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const { step, changing, instant, containerRef, goToStep } = useDealerRegistrationStep()

  const handleChange = (field: DealerRegisterField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async (keyboard = false) => {
    if (changing) return
    const validationErrors = validateDealerRegisterForm(values)
    setFormError(undefined)

    if (step < DEALER_REGISTRATION_STEPS.length - 1) {
      const fields = DEALER_REGISTRATION_STEPS[step].fields
      const stepErrors = Object.fromEntries(fields.flatMap((field) => {
        const messages = validationErrors[field] ?? errors[field]
        return messages?.length ? [[field, messages]] : []
      })) as DealerRegisterErrors
      setErrors((current) => ({ ...current, ...Object.fromEntries(fields.map((field) => [field, stepErrors[field]])) }))
      if (Object.keys(stepErrors).length > 0) return
      await goToStep(step + 1, keyboard)
      return
    }

    setErrors(validationErrors)
    const invalidStep = firstInvalidDealerStep(validationErrors)
    if (invalidStep >= 0) {
      await goToStep(invalidStep, keyboard)
      return
    }

    setSubmitting(true)
    try {
      await registerDealer(toPayload(values))
      // The route guards read the session state: load the new dealer before leaving the guest-only screen.
      await refresh()
      navigate('/concesionaria/suscripcion', { replace: true })
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        // Whoever is already logged in decides where / leads.
        await refresh()
        navigate('/', { replace: true })
      } else if (error instanceof HttpError && error.status === 422) {
        const serverErrors = fieldErrorsFromServer(error.body as ValidationBody)
        setErrors(serverErrors)
        const serverStep = firstInvalidDealerStep(serverErrors)
        if (serverStep >= 0) await goToStep(serverStep, keyboard)
        if (Object.keys(serverErrors).length === 0) setFormError(GENERIC_ERROR)
      } else {
        setFormError(GENERIC_ERROR)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={pageStyles.page} aria-labelledby="dealer-register-title">
      <AuthPageHeader className={pageStyles.header} />
      <div className={pageStyles.intro}>
        <h1 id="dealer-register-title">Registrá tu concesionaria</h1>
        <p>Completá los datos para solicitar la adhesión a la plataforma.</p>
      </div>
      <DealerRegistrationProgress step={step} instant={instant} />
      <div className={pageStyles.viewport}>
        <div ref={containerRef} className={pageStyles.card} inert={changing}>
        <DealerRegisterForm
          values={values}
          errors={errors}
          submitting={submitting}
          formError={formError}
          step={step}
          changing={changing}
          onPrevious={(keyboard) => goToStep(Math.max(0, step - 1), keyboard)}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
        </div>
      </div>
        <p className={`${linkStyles.prompt} ${pageStyles.login}`}>
          ¿Ya tenés cuenta? <AuthSwitchLink to="/login">Iniciar sesión</AuthSwitchLink>
        </p>
    </section>
  )
}
