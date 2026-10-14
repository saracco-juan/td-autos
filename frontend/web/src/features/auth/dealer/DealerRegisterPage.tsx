import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { HttpError } from '../../../lib/http'
import { registerDealer } from '../api'
import { useAuth } from '../session/useAuth'
import type { DealerRegisterPayload } from '../types'
import AuthCard from '../shared/AuthCard'
import linkStyles from '../shared/authLinks.module.css'
import DealerRegisterForm from './DealerRegisterForm'
import {
  validateDealerRegisterForm,
  type DealerRegisterErrors,
  type DealerRegisterField,
  type DealerRegisterFormValues,
} from './validateDealerRegisterForm'

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

  const handleChange = (field: DealerRegisterField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async () => {
    const validationErrors = validateDealerRegisterForm(values)
    setErrors(validationErrors)
    setFormError(undefined)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      await registerDealer(toPayload(values))
      // The route guards read the session state: load the new dealer before leaving the guest-only screen.
      await refresh()
      navigate('/concesionaria', { replace: true })
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        // Whoever is already logged in decides where / leads.
        await refresh()
        navigate('/', { replace: true })
      } else if (error instanceof HttpError && error.status === 422) {
        const serverErrors = fieldErrorsFromServer(error.body as ValidationBody)
        setErrors(serverErrors)
        if (Object.keys(serverErrors).length === 0) setFormError(GENERIC_ERROR)
      } else {
        setFormError(GENERIC_ERROR)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      wide
      title="Registrá tu concesionaria"
      titleId="dealer-register-title"
      subtitle="Completá los datos para solicitar la adhesión a la plataforma."
    >
      <DealerRegisterForm
        values={values}
        errors={errors}
        submitting={submitting}
        formError={formError}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
      <p className={linkStyles.prompt}>
        ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
      </p>
    </AuthCard>
  )
}
