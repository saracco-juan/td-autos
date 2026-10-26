import type { RecommendationFilters as Filters } from '@shared/recommendations/filters'
import buttonStyles from '../../components/button.module.css'
import { formatKilometers, formatPrice } from '../inventory/format'
import styles from './RecommendationFilters.module.css'

type Props = { value: Filters; onChange: (value: Filters) => void }
const NUMERIC_FIELDS = [
  { key: 'maxPrice', label: 'Precio máximo (ARS)', placeholder: 'Sin límite', min: 0, step: '0.01' },
  { key: 'minYear', label: 'Año desde', placeholder: 'Cualquiera', min: 1, step: '1' },
  { key: 'maxKilometers', label: 'Kilometraje máximo', placeholder: 'Sin límite', min: 0, step: '1' },
] as const

/** Draft inputs are uncontrolled; a changed applied value resets the form, not the disclosure. */
export default function RecommendationFilters({ value, onChange }: Props) {
  const chips: { key: keyof Filters; label: string }[] = []
  if (value.maxPrice !== undefined) chips.push({ key: 'maxPrice', label: `Hasta ${formatPrice(value.maxPrice)}` })
  if (value.minYear !== undefined) chips.push({ key: 'minYear', label: `Desde ${value.minYear}` })
  if (value.maxKilometers !== undefined) chips.push({ key: 'maxKilometers', label: `Hasta ${formatKilometers(value.maxKilometers)}` })
  if (value.transmission) chips.push({ key: 'transmission', label: value.transmission === 'manual' ? 'Manual' : 'Automática' })
  return (
    <aside className={styles.controls} aria-label="Filtros de recomendaciones">
      <details className={styles.panel}>
        <summary className={buttonStyles.button}>FILTROS</summary>
        <form key={JSON.stringify(value)} className={styles.form} onSubmit={(event) => {
          event.preventDefault()
          if (!event.currentTarget.checkValidity()) return
          const data = new FormData(event.currentTarget)
          const number = (key: string) => {
            const raw = String(data.get(key) ?? '').trim()
            return raw === '' ? undefined : Number(raw)
          }
          const transmission = data.get('transmission')
          onChange({ maxPrice: number('maxPrice'), minYear: number('minYear'),
            maxKilometers: number('maxKilometers'),
            transmission: transmission === 'manual' || transmission === 'automatica' ? transmission : undefined })
        }}>
          {NUMERIC_FIELDS.map(({ key, label, placeholder, min, step }) => (
            <label className={styles.field} key={key}>
              {label}
              <input name={key} type="number" min={min} step={step} placeholder={placeholder} defaultValue={value[key] ?? ''} />
            </label>
          ))}
          <label className={styles.field}>
            Transmisión
            <select name="transmission" defaultValue={value.transmission ?? ''}>
              <option value="">Cualquiera</option>
              <option value="manual">Manual</option>
              <option value="automatica">Automática</option>
            </select>
          </label>
          <button className={`${buttonStyles.button} ${buttonStyles.primary}`} type="submit">APLICAR</button>
        </form>
      </details>
      {chips.length > 0 ? (
        <div role="group" aria-label="Filtros aplicados" className={styles.chips}>
          {chips.map(({ key, label }) => (
            <button key={key} type="button" className={`${buttonStyles.button} ${styles.chip}`}
              aria-label={`Quitar ${label}`} onClick={() => onChange({ ...value, [key]: undefined })}>
              {label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button className={buttonStyles.button} type="button" onClick={() => onChange({})}>LIMPIAR FILTROS</button>
        </div>
      ) : null}
    </aside>
  )
}
