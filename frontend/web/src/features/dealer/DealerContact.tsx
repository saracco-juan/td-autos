import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, HttpError } from '../../lib/http'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import Field from '../auth/shared/Field'
import styles from '../profile/ProfileForm.module.css'

type Contact = { telefono_publico: string | null }
const ENDPOINT = '/api/concesionaria/contacto'

export default function DealerContact() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let current = true
    apiFetch<Contact>(ENDPOINT).then((contact) => {
      if (current) setPhone(contact.telefono_publico ?? '')
    }).catch(() => {
      if (current) setLoadFailed(true)
    }).finally(() => {
      if (current) setLoading(false)
    })
    return () => { current = false }
  }, [attempt])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(undefined)
    setSaved(false)
    try {
      const contact = await apiFetch<Contact>(ENDPOINT, { method: 'PUT', body: { telefono_publico: phone } })
      setPhone(contact.telefono_publico ?? '')
      setSaved(true)
    } catch (failure) {
      const message = failure instanceof HttpError && failure.status === 422
        ? (failure.body as { errors?: { telefono_publico?: string[] } })?.errors?.telefono_publico?.[0] : undefined
      setError(message ?? 'No se pudo guardar el teléfono. Intentá nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={styles.card} onSubmit={save} aria-labelledby="dealer-contact-title" noValidate>
      <h2 id="dealer-contact-title" className={styles.title}>CONTACTO DE LA CONCESIONARIA</h2>
      {loading ? <p>Cargando contacto…</p> : loadFailed ? <>
        <p role="alert" className={alertStyles.alert}>No se pudo cargar el teléfono.</p>
        <button type="button" className={buttonStyles.button} onClick={() => {
          setLoading(true)
          setLoadFailed(false)
          setAttempt((value) => value + 1)
        }}>REINTENTAR</button>
      </> : <>
        {saved ? <p role="status" className={alertStyles.notice}>El teléfono se guardó.</p> : null}
        <Field id="dealer-public-phone" label="Teléfono público / WhatsApp" errors={error ? [error] : undefined}>
          {(control) => <input {...control} type="tel" autoComplete="tel" maxLength={30}
            value={phone} disabled={saving} onChange={(event) => {
              setPhone(event.target.value)
              setError(undefined)
              setSaved(false)
            }} />}
        </Field>
        <p>Ingresá un número con WhatsApp y código de país. Si lo dejás vacío, se deshabilita el contacto.</p>
        <button className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.submit}`}
          type="submit" disabled={saving} aria-busy={saving}>{saving ? 'GUARDANDO…' : 'GUARDAR TELÉFONO'}</button>
      </>}
    </form>
  )
}
