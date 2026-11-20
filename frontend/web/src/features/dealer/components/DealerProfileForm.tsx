import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router'
import Button from '../../../components/Buttons/Button'
import Dialog from '../../../components/Dialog/Dialog'
import FlowLayout from '../../../components/FlowLayout/FlowLayout'
import barStyles from '../../../components/checklist/pinnedBar.module.css'
import Feedback from '../../../components/Feedback/Feedback'
import screenStyles from '../../../styles/screen.module.css'
import { HttpError } from '../../../lib/http'
import Field from '../../auth/shared/components/Field'
import TextField from '../../auth/shared/components/TextField'
import { updateDealerProfile } from '../api/profile'
import { editableFields, profileSections, profileValues, type DealerProfile, type DealerProfileErrors, type DealerProfileField } from '../model/profile'
import styles from './DealerProfileForm.module.css'

export default function DealerProfileForm({ profile }: Readonly<{ profile: DealerProfile }>) {
  const formId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const focusError = useRef(false)
  const [saved, setSaved] = useState(() => profileValues(profile))
  const [values, setValues] = useState(saved)
  const [errors, setErrors] = useState<DealerProfileErrors>({})
  const [failure, setFailure] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const dirty = editableFields.some((field) => values[field] !== saved[field])
  const blocker = useBlocker(dirty)

  useBeforeUnload((event) => {
    if (dirty) { event.preventDefault(); event.returnValue = '' }
  })

  useEffect(() => {
    if (focusError.current) {
      formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
      focusError.current = false
    }
  }, [errors])

  useEffect(() => {
    if (!dirty && blocker.state === 'blocked') blocker.reset()
  }, [dirty, blocker])

  function change(field: DealerProfileField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSuccess(false)
    setFailure('')
  }

  function discard() {
    setValues(saved)
    setErrors({})
    setFailure('')
    setSuccess(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty || submitting) return
    setSubmitting(true)
    setErrors({})
    setFailure('')
    setSuccess(false)
    try {
      const payload = profileValues(profile)
      for (const field of editableFields) payload[field] = values[field].trim()
      const updated = profileValues(await updateDealerProfile(payload))
      setSaved(updated)
      setValues(updated)
      setSuccess(true)
    } catch (error) {
      const body = error instanceof HttpError && error.status === 422
        ? error.body as { errors?: DealerProfileErrors } | undefined : undefined
      const fieldErrors: DealerProfileErrors = {}
      for (const field of editableFields) {
        if (body?.errors?.[field]?.length) fieldErrors[field] = body.errors[field]
      }
      focusError.current = true
      setErrors(fieldErrors)
      if (!Object.keys(fieldErrors).length) setFailure('No pudimos guardar los cambios. Intentá nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return <FlowLayout actions={<>
    <p className={styles.saveState}>{submitting ? 'Guardando cambios…' : dirty ? 'Cambios sin guardar' : ''}</p>
    <div ref={actionsRef} className={`${barStyles.actions} ${styles.actions}`}>
      <Button type="button" variant="secondary" className={barStyles.action} disabled={!dirty || submitting} onClick={discard}>DESCARTAR CAMBIOS</Button>
      <Button type="submit" form={formId} className={barStyles.action} disabled={!dirty || submitting} aria-busy={submitting}>
        {submitting ? 'GUARDANDO…' : 'GUARDAR CAMBIOS'}
      </Button>
    </div>
  </>}>
    <header className={styles.header}>
      <h1 className={screenStyles.title}>Perfil de la concesionaria</h1>
      <p>Mantené actualizados tus datos de contacto, ubicación y responsable.</p>
    </header>
    <form id={formId} ref={formRef} onSubmit={submit} noValidate className={styles.form} onFocus={(event) => {
      const bar = actionsRef.current?.parentElement?.getBoundingClientRect()
      if (bar && event.target.getBoundingClientRect().bottom > bar.top) {
        event.target.scrollIntoView({ block: 'center', behavior: 'instant' })
      }
    }}>
      <section className={styles.section} aria-labelledby={`${formId}-identity`}>
        <h2 id={`${formId}-identity`}>Identidad</h2>
        <div className={styles.fields}>
          {([{ name: 'nombre', label: 'Nombre comercial' }, { name: 'email', label: 'Email' }] as const).map(({ name, label }) => (
            <Field key={name} id={`${formId}-${name}`} label={label} hintId={`${formId}-identity-hint`}>
              {(control) => <input {...control} value={profile[name]} readOnly className={`${control.className} ${styles.readOnly}`} />}
            </Field>
          ))}
        </div>
        <p id={`${formId}-identity-hint`} className={styles.hint}>El nombre comercial y el email no se pueden editar.</p>
      </section>
      {profileSections.map((section, index) => <fieldset key={section.title} disabled={submitting} className={styles.section}>
        <legend><h2>{section.title}</h2></legend>
        <div className={styles.fields}>
          {section.fields.map((field) => <TextField key={field.name} id={`${formId}-${field.name}`} {...field}
            value={values[field.name]} errors={errors[field.name]} onChange={(value) => change(field.name, value)}
            hint={'hint' in field ? <p id={`${formId}-${field.name}-hint`} className={styles.hint}>{field.hint}</p> : undefined}
          />)}
        </div>
        {index === 1 ? <p className={styles.hint}>Estos datos identifican a la persona responsable de la cuenta.</p> : null}
      </fieldset>)}
      <Feedback message={failure || (success ? 'Guardaste los cambios del perfil.' : '')} variant={failure ? 'error' : 'success'} onRetry={submitting ? undefined : () => formRef.current?.requestSubmit()} />
    </form>
    {blocker.state === 'blocked' ? <Dialog open animate={false} title="Tenés cambios sin guardar" onClose={() => blocker.reset()} busy={submitting}>
      <p>Si salís, vas a perder los cambios que no guardaste.</p>
      <div className={styles.dialogActions}>
        <Button type="button" variant="secondary" disabled={submitting} onClick={() => blocker.reset()}>SEGUIR EDITANDO</Button>
        <Button type="button" disabled={submitting} onClick={() => blocker.proceed()}>SALIR SIN GUARDAR</Button>
      </div>
    </Dialog> : null}
  </FlowLayout>
}
