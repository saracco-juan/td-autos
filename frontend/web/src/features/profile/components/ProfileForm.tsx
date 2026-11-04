import Button from '../../../components/Buttons/Button'
import type { ChangeEvent, FormEvent } from 'react'
import alertStyles from '../../../styles/alert.module.css'
import Field from '../../auth/shared/components/Field'
import type { ProfileFieldErrors, ProfileFieldName, ProfileValues } from '../model/types'
import styles from './ProfileForm.module.css'

type Props = {
  values: ProfileValues
  // Shown for reference only: the email is the login identity and is never submitted.
  email: string
  errors: ProfileFieldErrors
  submitting: boolean
  formError?: string
  successMessage?: string
  onChange: (field: ProfileFieldName, value: string) => void
  onSubmit: () => void
}

export default function ProfileForm({
  values,
  email,
  errors,
  submitting,
  formError,
  successMessage,
  onChange,
  onSubmit,
}: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  const handleChange = (field: ProfileFieldName) => (event: ChangeEvent<HTMLInputElement>) =>
    onChange(field, event.target.value)

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby="profile-form-title" className={styles.card}>
      <h2 id="profile-form-title" className={styles.title}>
        DATOS PERSONALES
      </h2>
      <p className={styles.intro}>Podés actualizar tu nombre y apellido para identificar tu cuenta.</p>
      {successMessage ? (
        <p role="status" className={alertStyles.notice}>
          {successMessage}
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className={alertStyles.alert}>
          {formError}
        </p>
      ) : null}
      <div className={styles.fields}>
        <Field id="profile-name" label="Nombre" errors={errors.name}>
          {(control) => (
            <input
              {...control}
              type="text"
              name="name"
              autoComplete="given-name"
              value={values.name}
              onChange={handleChange('name')}
            />
          )}
        </Field>
        <Field id="profile-apellido" label="Apellido" errors={errors.apellido}>
          {(control) => (
            <input
              {...control}
              type="text"
              name="apellido"
              autoComplete="family-name"
              value={values.apellido}
              onChange={handleChange('apellido')}
            />
          )}
        </Field>
        <div className={styles.email}>
          <Field id="profile-email" label="Email" hint={
            <p id="profile-email-hint" className={styles.hint}>Es el email con el que iniciás sesión y no se puede editar desde acá.</p>
          }>
            {(control) => (
              <input
                {...control}
                className={`${control.className} ${styles.readOnly}`}
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                readOnly
              />
            )}
          </Field>
        </div>
      </div>
      <Button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        variant="secondary" className={styles.submit}
      >
        {submitting ? 'GUARDANDO…' : 'GUARDAR CAMBIOS'}
      </Button>
    </form>
  )
}
