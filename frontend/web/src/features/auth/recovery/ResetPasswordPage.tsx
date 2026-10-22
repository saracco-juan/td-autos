import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { HttpError } from '../../../lib/http'
import { resetPassword } from '../api'
import { useAuth } from '../session/useAuth'
import type { FieldErrors } from '../types'
import alertStyles from '../../../components/alert.module.css'
import buttonStyles from '../../../components/button.module.css'
import AuthCard from '../shared/AuthCard'
import { validateNewPassword } from '../shared/validateNewPassword'
import ResetPasswordForm, { type ResetPasswordValues } from './ResetPasswordForm'
import styles from './ResetPasswordPage.module.css'

const GENERIC_ERROR = 'No se pudo actualizar la contraseña. Intentá nuevamente.'
const INVALID_LINK = 'El enlace para restablecer tu contraseña no es válido. Solicitá uno nuevo.'

const EMPTY_VALUES: ResetPasswordValues = { password: '', passwordConfirmation: '' }

type FailureBody = {
  code?: string
  message?: string
  errors?: { password?: string[]; email?: string[] }
}

const isLinkFailure = (body: FailureBody | undefined) => body?.code === 'token_expired' || body?.code === 'token_invalid'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')
  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [serverLinkError, setServerLinkError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  // A link without its token or email cannot work: treat it as invalid before calling the API.
  const linkError = !token || !email ? INVALID_LINK : serverLinkError

  const handleChange = (field: keyof ResetPasswordValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async () => {
    if (!token || !email) return
    const validationErrors = validateNewPassword(values.password, values.passwordConfirmation)
    setErrors(validationErrors)
    setFormError(undefined)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      const notice = await resetPassword({
        token,
        email,
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
      })
      navigate('/login', { replace: true, state: { notice } })
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        await refresh()
        navigate('/', { replace: true })
      } else if (error instanceof HttpError && error.status === 422) {
        const body = error.body as FailureBody | undefined
        if (isLinkFailure(body)) {
          setServerLinkError(body?.message || INVALID_LINK)
        } else if (body?.errors?.email?.length) {
          // The email comes from the link, not from a field: a problem with it means the link is malformed.
          setServerLinkError(INVALID_LINK)
        } else if (body?.errors?.password?.length) {
          setErrors({ password: body.errors.password })
        } else {
          setFormError(GENERIC_ERROR)
        }
      } else {
        setFormError(GENERIC_ERROR)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Definí tu nueva contraseña" titleId="reset-title">
      {linkError ? (
        <>
          <p role="alert" className={alertStyles.alert}>
            {linkError}
          </p>
          <div className={styles.actions}>
            <Link to="/recuperar" className={`${buttonStyles.button} ${buttonStyles.primary}`}>
              SOLICITAR NUEVO ENLACE
            </Link>
            <Link to="/login" className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
              VOLVER AL ACCESO
            </Link>
          </div>
        </>
      ) : (
        <>
          <ResetPasswordForm
            values={values}
            errors={errors}
            submitting={submitting}
            formError={formError}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
          <Link to="/login" className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
            VOLVER AL ACCESO
          </Link>
        </>
      )}
    </AuthCard>
  )
}
