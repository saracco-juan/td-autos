import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { HttpError } from '../../../lib/http'
import { registerUser } from '../api'
import { googleErrorMessage } from '../googleErrors'
import { useAuth } from '../session/useAuth'
import type { FieldErrors } from '../types'
import alertStyles from '../../../components/alert.module.css'
import AuthCard from '../shared/AuthCard'
import GoogleAuthLink from '../shared/GoogleAuthLink'
import linkStyles from '../shared/authLinks.module.css'
import RegisterForm from './RegisterForm'
import { validateRegisterForm, type RegisterFormValues } from './validateRegisterForm'

const GENERIC_ERROR = 'No se pudo completar el registro. Intentá nuevamente.'
const SERVER_FIELDS = ['name', 'email', 'password'] as const

const EMPTY_VALUES: RegisterFormValues = {
  name: '',
  email: '',
  password: '',
  passwordConfirmation: '',
}

type ValidationBody = { errors?: Partial<Record<string, string[]>> }

function fieldErrorsFromServer(body: ValidationBody | undefined): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of SERVER_FIELDS) {
    const messages = body?.errors?.[field]
    if (messages && messages.length > 0) errors[field] = messages
  }
  return errors
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [searchParams] = useSearchParams()
  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const googleError = googleErrorMessage(searchParams.get('error'))

  const handleChange = (field: keyof RegisterFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async () => {
    const validationErrors = validateRegisterForm(values)
    setErrors(validationErrors)
    setFormError(undefined)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      await registerUser({
        name: values.name.trim(),
        apellido: null,
        email: values.email.trim(),
        password: values.password,
        password_confirmation: values.passwordConfirmation,
      })
      // The route guards read the session state: load the new user before leaving the guest-only screen.
      await refresh()
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
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
      title="Registrá tu cuenta"
      titleId="register-title"
      subtitle="Por favor, introducí tus datos para registrarte."
    >
      {googleError ? (
        <p role="alert" className={alertStyles.alert}>
          {googleError}
        </p>
      ) : null}
      <RegisterForm
        values={values}
        errors={errors}
        submitting={submitting}
        formError={formError}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
      <GoogleAuthLink from="registro" />
      <p className={linkStyles.prompt}>
        ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
      </p>
    </AuthCard>
  )
}
