import { useId, useRef, useState, type ReactNode } from 'react'
import { appliedFilterChips, type RecommendationFilters as Filters } from '@shared/recommendations/filters'
import buttonStyles from '../../components/button.module.css'
import styles from './RecommendationFilters.module.css'

type Props = {
  value: Filters
  onChange: (value: Filters) => void
  /** Rendered at the right of the toolbar (the comparison group). */
  actions?: ReactNode
  /** The results follow the expandable filter form. */
  children?: ReactNode
}
const NUMERIC_FIELDS = [
  { key: 'maxPrice', label: 'Precio máximo (ARS)', placeholder: 'Sin límite', min: 0, step: '0.01' },
  { key: 'minYear', label: 'Año desde', placeholder: 'Cualquiera', min: 1, step: '1' },
  { key: 'maxKilometers', label: 'Kilometraje máximo', placeholder: 'Sin límite', min: 0, step: '1' },
] as const

/** Draft inputs are uncontrolled; a changed applied value resets the form, not the disclosure. */
export default function RecommendationFilters({ value, onChange, actions, children }: Props) {
  const chips = appliedFilterChips(value)
  const [open, setOpen] = useState(false)
  const [animate, setAnimate] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  return (
    <>
      <div className={styles.toolbar} role="toolbar" aria-label="Filtros y comparación">
        <div className={styles.controls}>
          <button ref={toggle} type="button" className={`${buttonStyles.button} ${styles.toggle}`}
            aria-expanded={open} aria-controls={panelId} onClick={(event) => {
              setAnimate(event.detail > 0)
              setOpen(!open)
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4 7h6m4 0h6M4 17h10m4 0h2" />
              <circle cx="12" cy="7" r="2" /><circle cx="16" cy="17" r="2" />
            </svg>
            FILTROS
            {chips.length > 0 ? <span className={styles.count} aria-hidden="true">{chips.length}</span> : null}
          </button>
          {chips.length > 0 ? (
            <div role="group" aria-label="Filtros aplicados" className={styles.chips}>
              {chips.map(({ key, label }) => (
                <button key={key} type="button" className={`${buttonStyles.button} ${styles.chip}`}
                  aria-label={`Quitar ${label}`} onClick={() => onChange({ ...value, [key]: undefined })}>
                  {label} <span aria-hidden="true">×</span>
                </button>
              ))}
              <button className={`${buttonStyles.button} ${styles.clear}`} type="button" onClick={() => onChange({})}>LIMPIAR FILTROS</button>
            </div>
          ) : null}
        </div>
        {actions}
      </div>
      <div className={styles.body}>
        <div className={styles.disclosure} data-open={open} data-animate={animate}>
          <div className={styles.panelClip}>
            <aside id={panelId} className={styles.panel} aria-label="Filtros de recomendaciones" aria-hidden={!open} inert={!open}>
              <form key={JSON.stringify(value)} className={styles.form}
                onClickCapture={(event) => setAnimate(event.detail > 0)}
                onKeyDownCapture={() => setAnimate(false)}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!event.currentTarget.checkValidity()) return
                  const data = new FormData(event.currentTarget)
                  const number = (key: string) => {
                    const raw = String(data.get(key) ?? '').trim()
                    return raw === '' ? undefined : Number(raw)
                  }
                  const transmission = data.get('transmission')
                  setOpen(false)
                  toggle.current?.focus()
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
            </aside>
          </div>
        </div>
        {children}
      </div>
    </>
  )
}
