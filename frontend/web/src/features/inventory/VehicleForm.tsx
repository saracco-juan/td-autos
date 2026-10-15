import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import { HttpError, NetworkError } from '../../lib/http'
import type { BodyType } from '../diagnosis/types'
import SessionLoading from '../auth/session/SessionLoading'
import SelectField from '../auth/shared/SelectField'
import TextAreaField from '../auth/shared/TextAreaField'
import TextField from '../auth/shared/TextField'
import { fetchBodyTypes, type VehicleSubmission } from './api'
import { inactiveSubscriptionMessage } from './inactiveSubscription'
import { INVENTORY_PATH } from './inventoryRoutes'
import PhotoPicker from './PhotoPicker'
import SubscriptionBlockedNotice from './SubscriptionBlockedNotice'
import type { FotoVehiculo } from './types'
import { usePhotoDraft } from './usePhotoDraft'
import styles from './VehicleForm.module.css'
import {
  COMBUSTIBLE_OPTIONS,
  TRANSMISION_OPTIONS,
  errorsFromServer,
  firstInvalidField,
  validateVehicleForm,
  type VehicleErrorKey,
  type VehicleErrors,
  type VehicleFieldName,
  type VehicleValues,
} from './vehicleFields'

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'
const SAVE_ERROR = 'No pudimos guardar el vehículo. Probá de nuevo.'

type CatalogState = 'loading' | { ready: BodyType[] } | { error: ErrorKind }

type Props = {
  initialValues: VehicleValues
  // Photos the vehicle already has (edit); empty on create.
  initialPhotos: FotoVehiculo[]
  submitLabel: string
  // Saves the vehicle. A rejection stays in the form: 422 as field errors, anything else as a message; on success the caller leaves the screen.
  onSubmit: (submission: VehicleSubmission) => Promise<void>
}

const fieldId = (name: VehicleErrorKey) => `vehicle-${name}`

// A field is invalid: the focus goes there so the dealer does not have to hunt for it (the ids match the controls).
function focusField(name: VehicleErrorKey) {
  document.getElementById(fieldId(name))?.focus()
}

// Shared by loading and editing a vehicle (Figma 38:923 / 2119:1841): fields on the left, photos on the right, actions below.
export default function VehicleForm({ initialValues, initialPhotos, submitLabel, onSubmit }: Props) {
  const [catalog, setCatalog] = useState<CatalogState>('loading')
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<VehicleErrors>({})
  const [formError, setFormError] = useState<string>()
  const [blocked, setBlocked] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const draft = usePhotoDraft(initialPhotos)

  const loadCatalog = useCallback((isCancelled: () => boolean = () => false) => {
    fetchBodyTypes()
      .then((bodyTypes) => {
        if (!isCancelled()) setCatalog({ ready: bodyTypes })
      })
      .catch((error: unknown) => {
        if (!isCancelled()) setCatalog({ error: error instanceof NetworkError ? 'network' : 'server' })
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    loadCatalog(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadCatalog])

  const retry = () => {
    setCatalog('loading')
    loadCatalog()
  }

  const handleChange = (name: VehicleFieldName) => (value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const showErrors = (found: VehicleErrors) => {
    setErrors(found)
    const first = firstInvalidField(found)
    if (first) focusField(first)
    return first !== undefined
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(undefined)
    setBlocked(undefined)
    if (showErrors(validateVehicleForm(values, draft.count))) return

    setSubmitting(true)
    try {
      await onSubmit({ values, newPhotos: draft.added.map((photo) => photo.file), removedPhotoIds: draft.removedIds })
    } catch (error) {
      const inactive = inactiveSubscriptionMessage(error)
      if (inactive) {
        setBlocked(inactive)
        setSubmitting(false)
        return
      }
      const fromServer = error instanceof HttpError && error.status === 422 ? errorsFromServer(error.body) : {}
      if (!showErrors(fromServer)) setFormError(error instanceof NetworkError ? NETWORK_ERROR : SAVE_ERROR)
      setSubmitting(false)
    }
  }

  // The loader and the error are direct children of the content area so they are centered there.
  if (catalog === 'loading') return <SessionLoading />
  if ('error' in catalog) return <ErrorState kind={catalog.error} onRetry={retry} />

  const text = (name: VehicleFieldName, label: string, inputMode?: 'numeric' | 'decimal') => (
    <TextField
      id={fieldId(name)}
      name={name}
      label={label}
      autoComplete="off"
      inputMode={inputMode}
      value={values[name]}
      errors={errors[name]}
      onChange={handleChange(name)}
    />
  )

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
      <div className={styles.body}>
        <div className={styles.fields}>
          {text('patente', 'Patente')}
          {text('marca', 'Marca')}
          {text('modelo', 'Modelo')}
          {text('version', 'Versión (opcional)')}
          {text('anio', 'Año', 'numeric')}
          {text('kilometraje', 'Kilometraje', 'numeric')}
          {text('precio', 'Precio', 'decimal')}
          <SelectField
            id={fieldId('transmision')}
            name="transmision"
            label="Transmisión"
            value={values.transmision}
            options={TRANSMISION_OPTIONS}
            errors={errors.transmision}
            onChange={handleChange('transmision')}
          />
          <SelectField
            id={fieldId('combustible')}
            name="combustible"
            label="Combustible"
            value={values.combustible}
            options={COMBUSTIBLE_OPTIONS}
            errors={errors.combustible}
            onChange={handleChange('combustible')}
          />
          <SelectField
            id={fieldId('carroceria_id')}
            name="carroceria_id"
            label="Carrocería"
            value={values.carroceria_id}
            options={catalog.ready.map((bodyType) => ({ value: String(bodyType.id), label: bodyType.nombre }))}
            errors={errors.carroceria_id}
            onChange={handleChange('carroceria_id')}
          />
          {text('ubicacion', 'Ubicación')}
          <div className={styles.fullRow}>
            <TextAreaField
              id={fieldId('descripcion')}
              name="descripcion"
              label="Descripción (opcional)"
              value={values.descripcion}
              errors={errors.descripcion}
              onChange={handleChange('descripcion')}
            />
          </div>
        </div>
        <PhotoPicker draft={draft} errors={errors.fotos} />
      </div>
      {blocked ? <SubscriptionBlockedNotice message={blocked} /> : null}
      {formError ? (
        <p role="alert" className={alertStyles.alert}>
          {formError}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Link to={INVENTORY_PATH} className={`${buttonStyles.button} ${buttonStyles.danger} ${styles.cancel}`}>
          CANCELAR
        </Link>
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className={`${buttonStyles.button} ${buttonStyles.success} ${styles.submit}`}
        >
          {submitting ? 'GUARDANDO…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
