import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { HttpError } from '../../../lib/http'
import { requestPasswordReset } from '../api'
import { useAuth } from '../session/useAuth'
import type { FieldErrors } from '../types'
import alertStyles from '../../../components/alert.module.css'
import buttonStyles from '../../../components/button.module.css'
import AuthCard from '../shared/AuthCard'
import { validateEmail } from '../shared/validateEmail'
import RecoveryForm from './RecoveryForm'
import styles from './RecoveryPage.module.css'

const HELPER = 'Si existe una cuenta asociada, recibirás instrucciones por email.'
const GENERIC_ERROR = 'No se pudo enviar la solicitud. Intentá nuevamente.'

type ValidationBody = { errors?: { email?: string[] } }

export default function RecoveryPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [confirmation, setConfirmation] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (value: string) => {
    setEmail(value)
    setErrors({})
  }

  const handleSubmit = async () => {
    const emailErrors = validateEmail(email)
    setErrors(emailErrors ? { email: emailErrors } : {})
    setFormError(undefined)
    setConfirmation(undefined)
    if (emailErrors) return

    setSubmitting(true)
    try {
      setConfirmation(await requestPasswordReset(email.trim()))
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        await refresh()
        navigate('/', { replace: true })
      } else if (error instanceof HttpError && error.status === 422) {
        const emailMessages = (error.body as ValidationBody | undefined)?.errors?.email
        if (emailMessages?.length) setErrors({ email: emailMessages })
        else setFormError(GENERIC_ERROR)
      } else {
        setFormError(GENERIC_ERROR)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Recuperá tu contraseña" titleId="recovery-title">
      <RecoveryForm
        email={email}
        errors={errors}
        submitting={submitting}
        formError={formError}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
      {confirmation ? (
        <p role="status" className={alertStyles.notice}>
          {confirmation}
        </p>
      ) : (
        <p className={styles.helper}>{HELPER}</p>
      )}
      <Link to="/login" className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
        VOLVER AL ACCESO
      </Link>
    </AuthCard>
  )
}
