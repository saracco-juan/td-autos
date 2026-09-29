import { useState } from 'react'
import { useNavigate } from 'react-router'
import { HttpError } from '../../../lib/http'
import { registerUser } from '../api'
import type { FieldErrors } from '../types'
import RegisterForm from './RegisterForm'
import { validateRegisterForm, type RegisterFormValues } from './validateRegisterForm'

const GENERIC_ERROR = 'No se pudo completar el registro. Intente nuevamente.'
const SERVER_FIELDS = ['name', 'apellido', 'email', 'password'] as const

const EMPTY_VALUES: RegisterFormValues = {
  name: '',
  apellido: '',
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
  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

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
        apellido: values.apellido.trim() || null,
        email: values.email.trim(),
        password: values.password,
        password_confirmation: values.passwordConfirmation,
      })
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
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
    <main>
      <h1>Registro</h1>
      <RegisterForm
        values={values}
        errors={errors}
        submitting={submitting}
        formError={formError}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
    </main>
  )
}
