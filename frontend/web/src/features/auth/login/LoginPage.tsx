import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { HttpError } from '../../../lib/http'
import { googleErrorMessage } from '../googleErrors'
import { useAuth } from '../session/useAuth'
import type { FieldErrors } from '../types'
import alertStyles from '../../../components/alert.module.css'
import AuthCard from '../shared/AuthCard'
import GoogleAuthLink from '../shared/GoogleAuthLink'
import linkStyles from '../shared/authLinks.module.css'
import LoginForm from './LoginForm'
import styles from './LoginPage.module.css'
import { validateLoginForm, type LoginFormValues } from './validateLoginForm'

const GENERIC_ERROR = 'No se pudo iniciar sesión. Intentá nuevamente.'

const EMPTY_VALUES: LoginFormValues = { email: '', password: '' }

type ValidationBody = { errors?: { email?: string[] } }

// Router navigation state may carry a one-off notice, e.g. after a password reset.
function noticeFromState(state: unknown): string | undefined {
  const notice = (state as { notice?: unknown } | null)?.notice
  return typeof notice === 'string' && notice !== '' ? notice : undefined
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { login, refresh } = useAuth()
  const [searchParams] = useSearchParams()
  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const googleError = googleErrorMessage(searchParams.get('error'))
  const notice = noticeFromState(state)

  const handleChange = (field: keyof LoginFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async () => {
    const validationErrors = validateLoginForm(values)
    setErrors(validationErrors)
    setFormError(undefined)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      await login({ email: values.email.trim(), password: values.password })
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        await refresh()
        navigate('/', { replace: true })
      } else if (error instanceof HttpError && error.status === 422) {
        // Credential failures arrive under `email` but must not be tied to a field: they never reveal which one is wrong.
        setFormError((error.body as ValidationBody | undefined)?.errors?.email?.[0] ?? GENERIC_ERROR)
      } else {
        setFormError(GENERIC_ERROR)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Ingresá a tu cuenta" titleId="login-title" subtitle="Accedé para guardar tus favoritos.">
      {notice ? (
        <p role="status" className={alertStyles.notice}>
          {notice}
        </p>
      ) : null}
      {googleError ? (
        <p role="alert" className={alertStyles.alert}>
          {googleError}
        </p>
      ) : null}
      <LoginForm
        values={values}
        errors={errors}
        submitting={submitting}
        formError={formError}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
      <GoogleAuthLink from="login" />
      <div className={styles.links}>
        <p className={linkStyles.prompt}>
          ¿No tenés cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>
        <Link to="/recuperar" className={styles.forgot}>
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </AuthCard>
  )
}
