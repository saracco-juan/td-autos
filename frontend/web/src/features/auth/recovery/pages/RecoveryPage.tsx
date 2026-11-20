import ButtonLink from '../../../../components/Buttons/ButtonLink'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { HttpError } from '../../../../lib/http'
import { requestPasswordReset } from '../../api/client'
import { useAuth } from '../../session/hooks/useAuth'
import type { FieldErrors } from '../../model/types'
import Feedback from '../../../../components/Feedback/Feedback'
import AuthCard from '../../shared/components/AuthCard'
import AuthPageHeader from '../../shared/components/AuthPageHeader'
import { validateEmail } from '../../shared/model/validateEmail'
import RecoveryForm from '../components/RecoveryForm'
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
    <div className={styles.page}>
      <AuthPageHeader />
      <AuthCard embedded title="Recuperá tu contraseña" titleId="recovery-title">
        <RecoveryForm
          email={email}
          errors={errors}
          submitting={submitting}
          formError={formError}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
        {confirmation ? (
          <Feedback message={confirmation} />
        ) : (
          <p className={styles.helper}>{HELPER}</p>
        )}
        {confirmation ? <p className={styles.helper}>Revisá tu email y la carpeta de spam para continuar.</p> : null}
        <ButtonLink to="/login" variant="secondary">
          VOLVER AL ACCESO
        </ButtonLink>
      </AuthCard>
    </div>
  )
}
