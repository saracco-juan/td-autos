import { useState } from 'react'
import ButtonLink from '../../../components/Buttons/ButtonLink'
import { HttpError } from '../../../lib/http'
import alertStyles from '../../../styles/alert.module.css'
import { useAuth } from '../../auth/session/hooks/useAuth'
import { updateProfile } from '../api/client'
import ProfileForm from '../components/ProfileForm'
import PurchaseProgress from '../components/PurchaseProgress'
import styles from './ProfilePage.module.css'
import type { ProfileFieldErrors, ProfileFieldName, ProfileValues } from '../model/types'
import { validateProfileForm } from '../model/validateProfileForm'

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
  const displayName = [user?.name, user?.apellido].filter(Boolean).join(' ') || 'Tu cuenta'

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
        <h1 className={styles.title}>Perfil</h1>
        <p className={styles.subtitle}>Tu cuenta y el punto de partida de tu próximo auto.</p>
      </div>
      <div className={styles.body}>
        <section className={styles.identity} aria-labelledby="profile-identity-title">
          <h2 id="profile-identity-title" className={styles.name}>{displayName}</h2>
          <span className={styles.accountState}>
            {user?.perfil_completo ? 'Perfil completo' : 'Datos por completar'}
          </span>
          <p className={styles.description}>
            Mantené tus datos al día y retomá la búsqueda de un auto que vaya con vos.
          </p>
          <dl className={styles.accountDetails}>
            <div><dt>Cuenta</dt><dd>Comprador</dd></div>
            <div><dt>Diagnóstico</dt><dd>{user?.tiene_diagnostico ? 'Realizado' : 'Por empezar'}</dd></div>
          </dl>
        </section>
        <div className={styles.editor}>
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
      <PurchaseProgress />
      <section className={styles.journey} aria-labelledby="profile-journey-title">
        <h2 id="profile-journey-title">Seguí con tu búsqueda</h2>
        <div className={styles.journeyRow}>
          <div>
            <h3>Tu diagnóstico</h3>
            <p>{user?.tiene_diagnostico
              ? 'Si cambió lo que buscás, ajustá tus preferencias para encontrar otras opciones.'
              : 'Contanos qué necesitás para descubrir autos compatibles con vos.'}</p>
          </div>
          <ButtonLink to="/diagnostico" variant="secondary">
            {user?.tiene_diagnostico ? 'REVISAR DIAGNÓSTICO' : 'CREAR DIAGNÓSTICO'}
          </ButtonLink>
        </div>
        <div className={styles.journeyRow}>
          <div>
            <h3>Tus favoritos</h3>
            <p>Volvé a los autos que guardaste y compará tus opciones antes de decidir.</p>
          </div>
          <ButtonLink to="/favoritos" variant="secondary">VER FAVORITOS</ButtonLink>
        </div>
      </section>
    </div>
  )
}
