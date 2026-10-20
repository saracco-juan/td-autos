import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import barStyles from '../../components/checklist/pinnedBar.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import { HttpError, NetworkError } from '../../lib/http'
import type { BodyType } from '../diagnosis/types'
import SessionLoading from '../auth/session/SessionLoading'
import SelectField, { type SelectOption } from '../auth/shared/SelectField'
import TextAreaField from '../auth/shared/TextAreaField'
import TextField from '../auth/shared/TextField'
import { fetchBodyTypes, type VehicleSubmission } from './api'
import { inactiveSubscription, type InactiveSubscription } from './inactiveSubscription'
import { INVENTORY_PATH } from './inventoryRoutes'
import PhotoPicker from './PhotoPicker'
import SubscriptionBlockedNotice from './SubscriptionBlockedNotice'
import type { FotoVehiculo } from './types'
import { usePhotoDraft } from './usePhotoDraft'
import VehicleFormPage from './VehicleFormPage'
import { EQUIPMENT_GROUPS, YES_NO } from './matchingFields'
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
  title: string
  subtitle: string
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
export default function VehicleForm({ title, subtitle, initialValues, initialPhotos, submitLabel, onSubmit }: Props) {
  const formId = useId()
  const [catalog, setCatalog] = useState<CatalogState>('loading')
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<VehicleErrors>({})
  const [formError, setFormError] = useState<string>()
  const [blocked, setBlocked] = useState<InactiveSubscription>()
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
    if (first) {
      setFormError(`No se guardó el vehículo. ${found[first]?.join(' ')}`)
      focusField(first)
    }
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
      const inactive = inactiveSubscription(error)
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
  if (catalog === 'loading') {
    return (
      <VehicleFormPage title={title} subtitle={subtitle}>
        <SessionLoading />
      </VehicleFormPage>
    )
  }
  if ('error' in catalog) {
    return (
      <VehicleFormPage title={title} subtitle={subtitle}>
        <ErrorState kind={catalog.error} onRetry={retry} />
      </VehicleFormPage>
    )
  }

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

  const actions = (
    <div className={styles.actionArea}>
      {formError ? <p role="alert" className={alertStyles.alert}>{formError}</p> : null}
      <div className={barStyles.actions}>
        <Link to={INVENTORY_PATH} className={`${buttonStyles.button} ${buttonStyles.danger} ${barStyles.action}`}>
          CANCELAR
        </Link>
        <button
          type="submit"
          form={formId}
          disabled={submitting}
          aria-busy={submitting}
          className={`${buttonStyles.button} ${buttonStyles.success} ${barStyles.actionWide}`}
        >
          {submitting ? 'GUARDANDO…' : submitLabel}
        </button>
      </div>
    </div>
  )

  const choice = (name: VehicleFieldName, label: string, options: SelectOption[]) => (
    <SelectField
      id={fieldId(name)}
      name={name}
      label={label}
      value={values[name]}
      options={options}
      errors={errors[name]}
      onChange={handleChange(name)}
    />
  )

  return (
    <VehicleFormPage title={title} subtitle={subtitle} actions={actions}>
      <form id={formId} noValidate onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
        <div className={styles.body}>
          <div className={styles.fields}>
            <h2 className={styles.sectionTitle}>Datos del vehículo</h2>
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
            <h2 className={styles.sectionTitle}>Especificaciones</h2>
            {choice('moneda', 'Moneda del precio', [{ value: 'ARS', label: 'Pesos (ARS)' }, { value: 'USD', label: 'Dólares (USD)' }])}
            {text('plazas', 'Plazas (incluye conductor)', 'numeric')}
            {text('motor', 'Motor (ej. 1.8)')}
            {choice('turbo', 'Turbo', YES_NO)}
            {text('potencia', 'Potencia (CV)', 'numeric')}
            <h2 className={styles.sectionTitle}>Consumo</h2>
            <p className={styles.fullRow}>Informá L/100 km. Obligatorio para nafta y diésel; opcional para los demás combustibles.</p>
            {text('consumo_urbano', 'Consumo urbano (L/100 km)', 'decimal')}
            {text('consumo_ruta', 'Consumo en ruta (L/100 km)', 'decimal')}
            <p className={styles.fullRow}>En equipamiento, elegí sí o no en cada dato. Android Auto o Apple CarPlay: sí si tiene al menos uno.</p>
            {Object.entries(EQUIPMENT_GROUPS).map(([group, fields]) => (
              <section className={styles.fullRow} key={group} aria-label={group}>
                <h2 className={styles.sectionTitle}>{group}</h2>
                <div className={styles.fields}>
                  {fields.map(([key, label]) => <div key={key}>{choice(key, label, YES_NO)}</div>)}
                </div>
              </section>
            ))}
          </div>
          <PhotoPicker draft={draft} errors={errors.fotos} />
        </div>
        {blocked ? <SubscriptionBlockedNotice info={blocked} compact /> : null}
      </form>
    </VehicleFormPage>
  )
}
