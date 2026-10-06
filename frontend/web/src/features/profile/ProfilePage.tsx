import { useState } from 'react'
import { HttpError } from '../../lib/http'
import alertStyles from '../../components/alert.module.css'
import { useAuth } from '../auth/session/useAuth'
import { updateProfile } from './api'
import ProfileForm from './ProfileForm'
import styles from './ProfilePage.module.css'
import type { ProfileFieldErrors, ProfileFieldName, ProfileValues } from './types'
import { validateProfileForm } from './validateProfileForm'

const INCOMPLETE_NOTICE = 'Tu perfil está incompleto. Completá los datos obligatorios.'
const SUCCESS_MESSAGE = 'Los cambios se guardaron.'
const GENERIC_ERROR = 'No se pudieron guardar los cambios. Intentá nuevamente.'
const SERVER_FIELDS: ProfileFieldName[] = ['name', 'apellido']

type ValidationBody = { errors?: Partial<Record<string, string[]>> }

function fieldErrorsFromServer(body: ValidationBody | undefined): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}
  for (const field of SERVER_FIELDS) {
    const messages = body?.errors?.[field]
    if (messages && messages.length > 0) errors[field] = messages
  }
  return errors
}

export default function ProfilePage() {
  const { user, refresh } = useAuth()
  const [values, setValues] = useState<ProfileValues>({
    name: user?.name ?? '',
    apellido: user?.apellido ?? '',
  })
  const [errors, setErrors] = useState<ProfileFieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: ProfileFieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSaved(false)
  }

  const handleSubmit = async () => {
    const validationErrors = validateProfileForm(values)
    setErrors(validationErrors)
    setFormError(undefined)
    setSaved(false)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      await updateProfile({ name: values.name.trim(), apellido: values.apellido.trim() })
      // The nav and the incomplete notice read the session user: load the saved data.
      await refresh()
      setSaved(true)
    } catch (error) {
      const serverErrors =
        error instanceof HttpError && error.status === 422
          ? fieldErrorsFromServer(error.body as ValidationBody | undefined)
          : {}
      setErrors(serverErrors)
      if (Object.keys(serverErrors).length === 0) setFormError(GENERIC_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>PERFIL</p>
        <h1 className={styles.title}>Perfil</h1>
        <p className={styles.subtitle}>Datos personales</p>
      </div>
      <div className={styles.body}>
        {user && !user.perfil_completo ? <p className={alertStyles.warning}>{INCOMPLETE_NOTICE}</p> : null}
        <ProfileForm
          values={values}
          email={user?.email ?? ''}
          errors={errors}
          submitting={submitting}
          formError={formError}
          successMessage={saved ? SUCCESS_MESSAGE : undefined}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
