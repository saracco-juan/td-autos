import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import InfoTip from '../../components/InfoTip'
import screenStyles from '../../components/screen.module.css'
import { HttpError } from '../../lib/http'
import Field from '../auth/shared/Field'
import SessionLoading from '../auth/session/SessionLoading'
import { formatPrice } from '../inventory/format'
import { fetchCosts } from './api'
import { explainConcept, type Concept } from './explainConcept'
import { formatDate } from './format'
import styles from './OwnershipCostsPage.module.css'
import type { Coverage, CostsQuery, OwnershipCosts } from './types'
import { validateKm } from './validateKm'

const GENERIC_ERROR = 'No pudimos calcular los costos. Intentá de nuevo en unos minutos.'
const COVERAGES: { value: Coverage; label: string }[] = [
  { value: 'terceros_completo', label: 'Terceros completo' },
  { value: 'todo_riesgo', label: 'Todo riesgo' },
]
const KM_HINTS = {
  diagnostico: undefined,
  default: 'Usamos un valor estimado.',
  usuario: undefined,
}

type FieldErrors = { km?: string[]; coverage?: string[] }
type ValidationBody = { errors?: { km?: string[]; cobertura?: string[] } }

type RowProps = { label: string; value: string; strong?: boolean; info?: { name: string; text: string } }

function Row({ label, value, strong = false, info }: RowProps) {
  return (
    <div className={`${styles.row} ${strong ? styles.total : ''}`}>
      <dt>
        {label}
        {info ? <InfoTip label={`Cómo calculamos ${info.name}`}>{info.text}</InfoTip> : null}
      </dt>
      <dd>{value}</dd>
    </div>
  )
}

function messageOf(error: unknown): string {
  if (error instanceof HttpError && (error.status === 404 || error.status === 503)) {
    const message = (error.body as { message?: string } | null)?.message
    if (message) return message
  }
  return GENERIC_ERROR
}

function fieldErrorsOf(error: unknown): FieldErrors | null {
  if (!(error instanceof HttpError) || error.status !== 422) return null
  const errors = (error.body as ValidationBody | null)?.errors
  const found: FieldErrors = { km: errors?.km, coverage: errors?.cobertura }
  return found.km?.length || found.coverage?.length ? found : null
}

function MonthlyCard({ data }: { data: OwnershipCosts }) {
  const { monthly, yearly, breakdown } = data
  const info = (name: string, concept: Concept, amount: number | null) =>
    ({ name, text: explainConcept(concept, breakdown, amount) })
  const perMonth = (value: number) => `${formatPrice(value)} por mes`
  // Electric cars have no fuel to price yet: charging costs are announced, not estimated (D15).
  const electric = data.vehicle.fuel === 'electrico'
  return (
    <section className={styles.card} aria-labelledby="costs-monthly">
      <h2 id="costs-monthly" className={styles.cardTitle}>Para mantenerlo</h2>
      <dl className={styles.rows}>
        <Row
          label="Combustible"
          value={monthly.fuel !== null ? perMonth(monthly.fuel) : electric ? 'Próximamente' : 'No podemos estimarlo'}
          info={info('Combustible', electric && monthly.fuel === null ? 'charging' : 'fuel', monthly.fuel)}
        />
        <Row label="Seguro" value={perMonth(monthly.insurance)} info={info('Seguro', 'insurance', monthly.insurance)} />
        <Row label="Patente" value={perMonth(monthly.patente)} info={info('Patente', 'patente', monthly.patente)} />
        <Row label="Total por mes" value={formatPrice(monthly.total)} strong />
        <Row label="Service (por año)" value={formatPrice(yearly.service)} info={info('Service', 'service', yearly.service)} />
        <Row label="Total por año" value={formatPrice(yearly.total)} strong />
      </dl>
      {monthly.not_estimated.includes('fuel') ? (
        <p className={styles.note}>{electric ? 'El total no incluye la carga del auto.' : 'El total no incluye el combustible.'}</p>
      ) : null}
    </section>
  )
}

function PurchaseCard({ data }: { data: OwnershipCosts }) {
  const { purchase, vehicle, exchange_rate: rate, breakdown } = data
  const budget = purchase.budget
  const usd = vehicle.published_currency === 'USD' && rate
    ? { published: vehicle.published_price, rate: rate.sell }
    : undefined
  return (
    <section className={styles.card} aria-labelledby="costs-purchase">
      <h2 id="costs-purchase" className={styles.cardTitle}>Para comprarlo</h2>
      <dl className={styles.rows}>
        <Row
          label="Precio"
          value={formatPrice(purchase.price)}
          info={usd ? { name: 'Precio publicado', text: explainConcept('price', breakdown, purchase.price, usd) } : undefined}
        />
        <Row
          label="Transferencia"
          value={formatPrice(purchase.transfer)}
          info={{ name: 'Transferencia', text: explainConcept('transfer', breakdown, purchase.transfer) }}
        />
        <Row label="Total" value={formatPrice(purchase.total)} strong />
      </dl>
      {usd && rate ? (
        <p className={styles.note}>
          Publicado en {formatPrice(vehicle.published_price, 'USD')}, al dólar oficial venta de {formatPrice(rate.sell)} ({formatDate(rate.updated_at)}).
        </p>
      ) : null}
      {budget ? (
        <p className={budget.fits ? alertStyles.notice : alertStyles.warning}>
          {budget.fits
            ? `Entra en tu presupuesto (te sobran ${formatPrice(budget.difference)}).`
            : `Supera tu presupuesto por ${formatPrice(Math.abs(budget.difference))}.`}
        </p>
      ) : null}
    </section>
  )
}

// Figma 2373:7378 "06 - Calculadora financiera", reshaped to the cost blocks decided for UH-10 (DESIGN.md).
export default function OwnershipCostsPage() {
  const { id = '' } = useParams()
  const [data, setData] = useState<OwnershipCosts | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string>()
  const [km, setKm] = useState('')
  const [coverage, setCoverage] = useState<Coverage>('terceros_completo')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const latest = useRef(0)

  const load = useCallback((query: CostsQuery, first: boolean) => {
    const request = ++latest.current
    fetchCosts(id, query)
      .then((result) => {
        if (request !== latest.current) return
        setData(result)
        setKm(String(result.inputs.km_per_month))
        setCoverage(result.inputs.coverage)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (request !== latest.current) return
        const invalid = first ? null : fieldErrorsOf(error)
        if (invalid) setFieldErrors(invalid)
        else setPageError(messageOf(error))
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    load({}, true)
    return () => { latest.current += 1 }
  }, [load])

  const recalculate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const checked = validateKm(km)
    if ('error' in checked) {
      setFieldErrors({ km: [checked.error] })
      return
    }
    setLoading(true)
    setPageError(undefined)
    setFieldErrors({})
    load({ km: checked.km, coverage }, false)
  }

  const vehicle = data?.vehicle
  const title = vehicle ? [vehicle.make, vehicle.model, vehicle.version, vehicle.year].filter(Boolean).join(' ') : ''
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to="/recomendaciones" className={styles.backLink}>
          <span aria-hidden="true" className={styles.backIcon}>‹</span>
          Volver a recomendaciones
        </Link>
        {vehicle ? (
          <div className={styles.titleBlock}>
            <p className={screenStyles.eyebrow}>COSTO DE POSESIÓN</p>
            <h1 className={screenStyles.title}>{title}</h1>
            <p className={styles.subtitle}>Cuánto te costaría comprarlo y mantenerlo, más allá del precio publicado.</p>
          </div>
        ) : null}
      </div>
      {pageError ? <p role="alert" className={alertStyles.alert}>{pageError}</p> : null}
      {data ? (
        <form className={styles.form} noValidate onSubmit={recalculate} aria-label="Datos para el cálculo">
          <Field
            id="costs-km"
            label="Kilómetros por mes"
            errors={fieldErrors.km}
            hint={KM_HINTS[data.inputs.km_source] ? (
              <p id="costs-km-hint" className={styles.hint}>{KM_HINTS[data.inputs.km_source]}</p>
            ) : undefined}
          >
            {(control) => (
              <input
                {...control}
                type="number"
                name="km"
                inputMode="numeric"
                value={km}
                onChange={(event) => setKm(event.target.value)}
              />
            )}
          </Field>
          <Field id="costs-coverage" label="Cobertura del seguro" errors={fieldErrors.coverage}>
            {(control) => (
              <select {...control} name="cobertura" value={coverage} onChange={(event) => setCoverage(event.target.value as Coverage)}>
                {COVERAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </Field>
          {/* The spacer takes the height of a field label, so the button lines up with the inputs. */}
          <div className={styles.action}>
            <span aria-hidden="true" className={styles.actionSpacer}>&nbsp;</span>
            <button
              type="submit"
              disabled={loading}
              className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.submit}`}
            >
              RECALCULAR
            </button>
          </div>
        </form>
      ) : null}
      {loading || data ? (
        <div className={styles.results}>
          {loading ? <SessionLoading /> : null}
          {!loading && data ? (
            <>
              <div className={styles.cards}>
                <MonthlyCard data={data} />
                <PurchaseCard data={data} />
              </div>
              <p className={styles.disclaimer}>
                Estimación orientativa con valores actualizados al {formatDate(data.rates_updated_at)}
                {data.vehicle.province ? `, en la provincia de ${data.vehicle.province}` : ''}. Es un estimativo aproximado.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
