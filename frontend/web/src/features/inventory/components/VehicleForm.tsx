import ButtonLink from '../../../components/Buttons/ButtonLink'
import Button from '../../../components/Buttons/Button'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import alertStyles from '../../../styles/alert.module.css'
import barStyles from '../../../components/checklist/pinnedBar.module.css'
import ErrorState, { type ErrorKind } from '../../../components/ErrorState/ErrorState'
import { HttpError, NetworkError } from '../../../lib/http'
import type { BodyType } from '../../diagnosis/model/types'
import SessionLoading from '../../auth/session/components/SessionLoading'
import SelectField, { type SelectOption } from '../../auth/shared/components/SelectField'
import TextAreaField from '../../auth/shared/components/TextAreaField'
import TextField from '../../auth/shared/components/TextField'
import { fetchBodyTypes, fetchVehicleCatalog, type VehicleSubmission } from '../api/client'
import CatalogField from './CatalogField'
import { inactiveSubscription, type InactiveSubscription } from '../model/inactiveSubscription'
import { INVENTORY_PATH } from '../model/inventoryRoutes'
import PhotoPicker from './PhotoPicker'
import SubscriptionBlockedNotice from './SubscriptionBlockedNotice'
import FormProgress from '../../../components/FormProgress/FormProgress'
import type { FotoVehiculo, VehicleCatalog } from '../model/types'
import { usePhotoDraft } from '../hooks/usePhotoDraft'
import VehicleFormPage from '../pages/VehicleFormPage'
import { EQUIPMENT_GROUPS } from '@shared/vehicles/equipment'
import { YES_NO } from '../model/matchingFields'
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
} from '../model/vehicleFields'
import { errorsForVehicleStep, vehicleStepForError, VEHICLE_FORM_STEPS } from '../model/vehicleFormSteps'

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'
const SAVE_ERROR = 'No pudimos guardar el vehículo. Probá de nuevo.'

type CatalogState = 'loading' | { ready: BodyType[]; identities: VehicleCatalog | null } | { error: ErrorKind }

type Props = {
  title: string
  subtitle: string
  initialValues: VehicleValues
  // Photos the vehicle already has (edit); empty on create.
  initialPhotos: FotoVehiculo[]
  isEditing?: boolean
  createWizard?: boolean
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
export default function VehicleForm({ title, subtitle, initialValues, initialPhotos, isEditing = false, createWizard = false, submitLabel, onSubmit }: Props) {
  const formId = useId()
  const [catalog, setCatalog] = useState<CatalogState>('loading')
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<VehicleErrors>({})
  const [formError, setFormError] = useState<string>()
  const [blocked, setBlocked] = useState<InactiveSubscription>()
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)
  const pendingFocus = useRef<{ field?: VehicleErrorKey; heading?: boolean } | undefined>(undefined)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const draft = usePhotoDraft(initialPhotos)

  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = undefined
    if (target.field) focusField(target.field)
    else stepHeading.current?.focus()
  })

  const loadCatalog = useCallback((isCancelled: () => boolean = () => false) => {
    Promise.all([fetchBodyTypes(), fetchVehicleCatalog().catch(() => null)])
      .then(([bodyTypes, identities]) => {
        if (!isCancelled()) setCatalog({ ready: bodyTypes, identities })
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
    const identity = ['marca', 'modelo', 'version'].includes(name)
    setValues((current) => {
      const next = { ...current, [name]: value }
      if (identity) {
        if (name === 'marca') next.modelo = ''
        if (name !== 'version') next.version = ''
        const entries = catalog !== 'loading' && 'ready' in catalog ? catalog.identities?.entries ?? [] : []
        next.acara_version_id = entries.find((entry) => entry.marca === next.marca && entry.modelo === next.modelo && entry.version === next.version)?.id ?? ''
      }
      return next
    })
    setErrors((current) => ({ ...current, [name]: undefined, ...(identity ? { modelo: undefined, version: undefined } : {}) }))
  }

  const showErrors = (found: VehicleErrors) => {
    setErrors(found)
    const first = firstInvalidField(found)
    if (first) {
      setFormError(`No se guardó el vehículo. ${found[first]?.join(' ')}`)
      if (createWizard) {
        pendingFocus.current = { field: first }
        setStep(vehicleStepForError(first))
      } else {
        focusField(first)
      }
    }
    return first !== undefined
  }

  const validate = () => {
    const found = validateVehicleForm(values, draft.count)
    if (!values.acara_version_id) found.version = ['Elegí la marca, el modelo y la versión del catálogo.']
    return found
  }

  const handleNext = () => {
    setFormError(undefined)
    const currentErrors = errorsForVehicleStep(validate(), step)
    if (showErrors(currentErrors)) return
    pendingFocus.current = { heading: true }
    setStep((current) => Math.min(current + 1, VEHICLE_FORM_STEPS.length - 1))
  }

  const handlePrevious = () => {
    pendingFocus.current = { heading: true }
    setStep((current) => Math.max(0, current - 1))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createWizard && step < VEHICLE_FORM_STEPS.length - 1) {
      handleNext()
      return
    }
    setFormError(undefined)
    setBlocked(undefined)
    const found = validate()
    if (showErrors(found)) return

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
      {createWizard ? (
        <div className={barStyles.actions}>
          {step === 0 ? <ButtonLink to={INVENTORY_PATH} variant="danger" className={barStyles.action}>CANCELAR</ButtonLink> : <Button type="button" variant="secondary" className={barStyles.action} onClick={handlePrevious}>ANTERIOR</Button>}
          <Button type="submit" form={formId} disabled={submitting} aria-busy={submitting} variant="primary" className={barStyles.actionWide}>
            {step === VEHICLE_FORM_STEPS.length - 1 ? (submitting ? 'GUARDANDO…' : submitLabel) : 'SIGUIENTE'}
          </Button>
        </div>
      ) : (
        <div className={barStyles.actions}>
          <ButtonLink to={INVENTORY_PATH} variant="danger" className={`${barStyles.action}`}>CANCELAR</ButtonLink>
          <Button type="submit" form={formId} disabled={submitting} aria-busy={submitting} variant="success" className={`${barStyles.actionWide}`}>
            {submitting ? 'GUARDANDO…' : submitLabel}
          </Button>
        </div>
      )}
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

  const entries = catalog.identities?.entries ?? []
  const visible = (target: number) => !createWizard || step === target
  const identity = (name: 'marca' | 'modelo' | 'version', label: string) => {
    const filtered = entries.filter((entry) => name === 'marca' || (entry.marca === values.marca && (name === 'modelo' || entry.modelo === values.modelo)))
    return <CatalogField id={fieldId(name)} name={name} label={label} value={values[name]}
      options={[...new Set(filtered.map((entry) => entry[name]))]} errors={errors[name]} onChange={handleChange(name)} />
  }

  return (
    <VehicleFormPage title={title} subtitle={subtitle} actions={actions} beforeForm={createWizard ? <FormProgress ariaLabel="Carga de vehículo" labels={VEHICLE_FORM_STEPS.map(({ title: label }) => label)} step={step} /> : null}>
      <form id={formId} noValidate onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
        <section className={createWizard ? styles.wizardPanel : undefined} key={createWizard ? step : 'full-form'}>
          {createWizard ? <><h2 ref={stepHeading} tabIndex={-1} className={styles.wizardHeading}>{VEHICLE_FORM_STEPS[step].title}</h2><p className={styles.stepDescription}>{VEHICLE_FORM_STEPS[step].description}</p></> : null}
          <div className={styles.body}>
            {!(createWizard && step === VEHICLE_FORM_STEPS.length - 1) ? <div className={styles.fields}>
              {visible(0) ? <>
                {!createWizard ? <h2 className={styles.sectionTitle}>Datos del vehículo</h2> : null}
                <div className={styles.fullRow}>
                  <p>Buscá y elegí la marca, el modelo y la versión del catálogo.</p>
                  {!catalog.identities ? <p className={alertStyles.alert}>El catálogo no está disponible. Podés guardar cambios de vehículos vinculados, pero no vincular una versión nueva. <Button type="button" onClick={retry}>REINTENTAR</Button></p> : null}
                  {catalog.identities?.stale ? <p>Usamos el último catálogo disponible. Sus precios pueden estar desactualizados.</p> : null}
                  {isEditing && !initialValues.acara_version_id ? <p>Este vehículo no está vinculado al catálogo. Elegí una versión del catálogo para guardar cambios.</p> : null}
                </div>
                {text('patente', 'Patente')}
                {identity('marca', 'Marca')}
                {identity('modelo', 'Modelo')}
                {identity('version', 'Versión')}
                {text('anio', 'Año', 'numeric')}
              </> : null}
              {visible(1) ? <>
                {text('kilometraje', 'Kilometraje', 'numeric')}
                {text('precio', 'Precio', 'decimal')}
                {createWizard ? <>
                  {choice('moneda', 'Moneda del precio', [{ value: 'ARS', label: 'Pesos (ARS)' }, { value: 'USD', label: 'Dólares (USD)' }])}
                  {text('ubicacion', 'Ubicación')}
                  <div className={styles.fullRow}><TextAreaField id={fieldId('descripcion')} name="descripcion" label="Descripción (opcional)" value={values.descripcion} errors={errors.descripcion} onChange={handleChange('descripcion')} /></div>
                </> : null}
              </> : null}
              {visible(2) ? <>
                <SelectField id={fieldId('transmision')} name="transmision" label="Transmisión" value={values.transmision} options={TRANSMISION_OPTIONS} errors={errors.transmision} onChange={handleChange('transmision')} />
                <SelectField id={fieldId('combustible')} name="combustible" label="Combustible" value={values.combustible} options={COMBUSTIBLE_OPTIONS} errors={errors.combustible} onChange={handleChange('combustible')} />
                <SelectField id={fieldId('carroceria_id')} name="carroceria_id" label="Carrocería" value={values.carroceria_id} options={catalog.ready.map((bodyType) => ({ value: String(bodyType.id), label: bodyType.nombre }))} errors={errors.carroceria_id} onChange={handleChange('carroceria_id')} />
                {!createWizard ? <>
                  {text('ubicacion', 'Ubicación')}
                  <div className={styles.fullRow}><TextAreaField id={fieldId('descripcion')} name="descripcion" label="Descripción (opcional)" value={values.descripcion} errors={errors.descripcion} onChange={handleChange('descripcion')} /></div>
                  <h2 className={styles.sectionTitle}>Especificaciones</h2>
                  {choice('moneda', 'Moneda del precio', [{ value: 'ARS', label: 'Pesos (ARS)' }, { value: 'USD', label: 'Dólares (USD)' }])}
                </> : null}
                {text('plazas', 'Plazas (incluye conductor)', 'numeric')}
                {text('motor', 'Motor (ej. 1.8)')}
                {choice('turbo', 'Turbo', YES_NO)}
                {text('potencia', 'Potencia (CV)', 'numeric')}
                {!createWizard ? <><h2 className={styles.sectionTitle}>Consumo</h2><p className={styles.fullRow}>Informá L/100 km. Obligatorio para nafta y diésel; opcional para los demás combustibles.</p></> : <p className={styles.fullRow}>Informá L/100 km. Obligatorio para nafta y diésel; opcional para los demás combustibles.</p>}
                {text('consumo_urbano', 'Consumo urbano (L/100 km)', 'decimal')}
                {text('consumo_ruta', 'Consumo en ruta (L/100 km)', 'decimal')}
              </> : null}
              {visible(3) ? <>
                <p className={styles.fullRow}>Elegí sí o no en cada dato. Android Auto o Apple CarPlay: sí si tiene al menos uno.</p>
                {Object.entries(EQUIPMENT_GROUPS).map(([group, fields]) => (
                  <section className={styles.fullRow} key={group} aria-label={group}>
                    <h2 className={styles.sectionTitle}>{group}</h2>
                    <div className={styles.fields}>{fields.map(([key, label]) => <div key={key}>{choice(key, label, YES_NO)}</div>)}</div>
                  </section>
                ))}
              </> : null}
            </div> : null}
            {visible(4) || !createWizard ? <PhotoPicker draft={draft} errors={errors.fotos} /> : null}
          </div>
        </section>
        {blocked ? <SubscriptionBlockedNotice info={blocked} compact /> : null}
      </form>
    </VehicleFormPage>
  )
}
