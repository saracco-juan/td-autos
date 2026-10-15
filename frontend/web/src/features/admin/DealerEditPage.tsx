import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import screenStyles from '../../components/screen.module.css'
import { HttpError, NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import TextField, { type TextFieldProps } from '../auth/shared/TextField'
import adminStyles from './admin.module.css'
import { fetchDealer, updateDealer } from './api'
import BackLink from './BackLink'
import styles from './DealerEditPage.module.css'
import DealerOverview from './DealerOverview'
import MissingState from './MissingState'
import type { DealerDetail, DealerFormField, DealerFormValues } from './types'
import { validateDealerForm, type DealerFormErrors } from './validateDealerForm'

type LoadState = 'loading' | 'missing' | { error: ErrorKind } | { dealer: DealerDetail }

type FieldConfig = Pick<TextFieldProps, 'label' | 'type' | 'autoComplete'> & { field: DealerFormField }

const NOT_FOUND = 'No encontramos la concesionaria.'
const SUCCESS = 'Guardaste los cambios de la concesionaria.'
const SAVE_ERROR = 'No pudimos guardar los cambios. Intentá nuevamente.'

// Row by row: left column, then right column. Locality and province are separate inputs (D2).
const FIELDS: FieldConfig[] = [
  { field: 'nombre', label: 'Nombre comercial', autoComplete: 'off' },
  { field: 'email', label: 'Email', type: 'email', autoComplete: 'off' },
  { field: 'responsable_nombre', label: 'Nombre del responsable', autoComplete: 'off' },
  { field: 'responsable_apellido', label: 'Apellido del responsable', autoComplete: 'off' },
  { field: 'responsable_dni', label: 'DNI del responsable', autoComplete: 'off' },
  { field: 'telefono_responsable', label: 'Teléfono del responsable', type: 'tel', autoComplete: 'off' },
  { field: 'telefono_publico', label: 'Teléfono público', type: 'tel', autoComplete: 'off' },
  { field: 'direccion', label: 'Dirección', autoComplete: 'off' },
  { field: 'localidad', label: 'Localidad', autoComplete: 'off' },
  { field: 'provincia', label: 'Provincia', autoComplete: 'off' },
]

const FORM_FIELDS = FIELDS.map(({ field }) => field)

type ValidationBody = { errors?: Partial<Record<string, string[]>> }

// Only the editable keys go to the API; the detail also carries the state, subscription and receipts.
function formValues(dealer: DealerDetail): DealerFormValues {
  return Object.fromEntries(FORM_FIELDS.map((field) => [field, dealer[field] ?? ''])) as DealerFormValues
}

function trimmed(values: DealerFormValues): DealerFormValues {
  return Object.fromEntries(FORM_FIELDS.map((field) => [field, values[field].trim()])) as DealerFormValues
}

function serverErrors(body: ValidationBody | undefined): DealerFormErrors {
  const errors: DealerFormErrors = {}
  for (const field of FORM_FIELDS) {
    const messages = body?.errors?.[field]
    if (messages && messages.length > 0) errors[field] = messages
  }
  return errors
}

type FormProps = {
  dealer: DealerDetail
  onSaved: (dealer: DealerDetail) => void
  onMissing: () => void
}

function DealerForm({ dealer, onSaved, onMissing }: FormProps) {
  const navigate = useNavigate()
  const [values, setValues] = useState(() => formValues(dealer))
  const [errors, setErrors] = useState<DealerFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setResult(null)
    setFailure(null)
    const validationErrors = validateDealerForm(values)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      const saved = await updateDealer(dealer.id, trimmed(values))
      onSaved(saved)
      setValues(formValues(saved))
      setResult(SUCCESS)
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        onMissing()
        return
      }
      const fieldErrors = error instanceof HttpError && error.status === 422 ? serverErrors(error.body as ValidationBody) : {}
      setErrors(fieldErrors)
      if (Object.keys(fieldErrors).length === 0) setFailure(SAVE_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {result ? (
        <p role="status" className={`${alertStyles.notice} ${styles.message}`}>
          {result}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className={`${alertStyles.alert} ${styles.message}`}>
          {failure}
        </p>
      ) : null}
      <form onSubmit={(event) => void handleSubmit(event)} noValidate className={styles.form}>
        <div className={styles.fields}>
          {FIELDS.map(({ field, ...textField }) => (
            <TextField
              key={field}
              {...textField}
              id={`dealer-edit-${field}`}
              name={field}
              value={values[field]}
              errors={errors[field]}
              onChange={(value) => {
                setValues((current) => ({ ...current, [field]: value }))
                setErrors((current) => ({ ...current, [field]: undefined }))
              }}
            />
          ))}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.danger}`}
            onClick={() => void navigate('/admin/concesionarias')}
          >
            CANCELAR
          </button>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className={`${buttonStyles.button} ${buttonStyles.success}`}
          >
            {submitting ? 'GUARDANDO…' : 'GUARDAR CONCESIONARIA'}
          </button>
        </div>
      </form>
    </>
  )
}

// Dealer page (Figma 38:1099, UH27, RF32): edits the dealer's data and shows its subscription and receipts.
function DealerEditContent({ id }: { id: number }) {
  const [loadState, setLoadState] = useState<LoadState>('loading')

  // `isCancelled` lets the effect drop the answer of a page that is gone.
  const load = useCallback(
    (isCancelled: () => boolean = () => false) => {
      fetchDealer(id)
        .then((dealer) => {
          if (!isCancelled()) setLoadState({ dealer })
        })
        .catch((error: unknown) => {
          if (isCancelled()) return
          if (error instanceof HttpError && error.status === 404) setLoadState('missing')
          else setLoadState({ error: error instanceof NetworkError ? 'network' : 'server' })
        })
    },
    [id],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  if (loadState === 'loading') return <SessionLoading />
  if (loadState === 'missing') return <MissingState message={NOT_FOUND} />
  if ('error' in loadState) {
    return (
      <ErrorState
        kind={loadState.error}
        onRetry={() => {
          setLoadState('loading')
          load()
        }}
      />
    )
  }

  const { dealer } = loadState

  return (
    <div className={screenStyles.page}>
      <div className={adminStyles.header}>
        <BackLink />
        <p className={screenStyles.eyebrow}>CONCESIONARIAS</p>
        <h1 className={screenStyles.title}>Editar concesionaria</h1>
        <p className={adminStyles.subtitle}>Cambios sobre el registro seleccionado.</p>
      </div>
      <DealerForm dealer={dealer} onSaved={(saved) => setLoadState({ dealer: saved })} onMissing={() => setLoadState('missing')} />
      <DealerOverview dealer={dealer} />
    </div>
  )
}

export default function DealerEditPage() {
  const id = Number(useParams().id)
  // Another dealer on the same mounted page: start over, so nothing of the previous one stays on screen.
  return <DealerEditContent key={id} id={id} />
}
